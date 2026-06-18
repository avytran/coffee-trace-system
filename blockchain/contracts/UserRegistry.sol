// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract UserRegistry {
    // ── ENUMS ────────────────────────────────────────────────────────────────
    enum Role { ADMIN, FARMER, COOPERATIVE, PROCESSOR, EXPORTER, RECEIVER, ANONYMOUS }
    enum Status { ACTIVE, SUSPENDED }

    // ── STRUCT ───────────────────────────────────────────────────────────────
    struct User {
        address wallet;
        Role role;
        Status status;
        uint256 createdAt;
    }

    // ── STORAGE ──────────────────────────────────────────────────────────────
    address public rootAdmin;
    mapping(address => User) private users;

    // ── EVENTS ───────────────────────────────────────────────────────────────
    event UserRegistered(address indexed wallet, Role indexed role, Status status, uint256 createdAt);
    event UserRoleUpdated(address indexed wallet, Role oldRole, Role newRole, address indexed updatedBy);
    event UserStatusUpdated(address indexed wallet, Status oldStatus, Status newStatus, address indexed updatedBy);

    // ── MODIFIERS ────────────────────────────────────────────────────────────
    modifier onlyAdmin() {
        require(
            users[msg.sender].role == Role.ADMIN || msg.sender == rootAdmin, 
            "Robustrace: Chi ADMIN moi co quyen"
        );
        _;
    }

    // ── CONSTRUCTOR ──────────────────────────────────────────────────────────
    constructor() {
        rootAdmin = msg.sender;
        users[msg.sender] = User({
            wallet: msg.sender,
            role: Role.ADMIN,
            status: Status.ACTIVE,
            createdAt: block.timestamp
        });
        emit UserRegistered(msg.sender, Role.ADMIN, Status.ACTIVE, block.timestamp);
    }

    // ── WRITE FUNCTIONS ──────────────────────────────────────────────────────
    function registerUser(address _wallet, Role _role) external onlyAdmin {
        require(_wallet != address(0), "Robustrace: Dia chi vi khong hop le");
        require(users[_wallet].wallet == address(0), "Robustrace: Tai khoan da ton tai");

        users[_wallet] = User({
            wallet: _wallet,
            role: _role,
            status: Status.ACTIVE,
            createdAt: block.timestamp
        });

        emit UserRegistered(_wallet, _role, Status.ACTIVE, block.timestamp);
    }

    function updateUserRole(address _wallet, Role _newRole) external onlyAdmin {
        require(users[_wallet].wallet != address(0), "Robustrace: User khong ton tai");
        Role oldRole = users[_wallet].role;
        users[_wallet].role = _newRole;
        emit UserRoleUpdated(_wallet, oldRole, _newRole, msg.sender);
    }

    function updateUserStatus(address _wallet, Status _newStatus) external onlyAdmin {
        require(users[_wallet].wallet != address(0), "Robustrace: User khong ton tai");
        Status oldStatus = users[_wallet].status;
        users[_wallet].status = _newStatus;
        emit UserStatusUpdated(_wallet, oldStatus, _newStatus, msg.sender);
    }

    // ── VIEW FUNCTIONS INTERFACE (Phục vụ cho các Contract khác gọi sang) ─────
    function getUser(address _wallet) external view returns (User memory) {
        return users[_wallet];
    }

    function hasRole(address _wallet, uint8 _role) external view returns (bool) {
        return (uint8(users[_wallet].role) == _role && users[_wallet].status == Status.ACTIVE);
    }

    function isActive(address _wallet) external view returns (bool) {
        return (users[_wallet].wallet != address(0) && users[_wallet].status == Status.ACTIVE);
    }
}