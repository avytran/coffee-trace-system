// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUserRegistry {
    function isActive(address _wallet) external view returns (bool);
    function hasRole(address _wallet, uint8 _role) external view returns (bool);
}

contract BatchRegistry {
    enum BatchStatus { INITIAL, HARVESTED, PRE_PROCESSED, REJECTED, PROCESSED, ASSESSED, EXPORTED, COMPLETED }

    struct CoffeeBatch {
        string batchId; // UUID chuyển thành string key
        BatchStatus status;
        address currentOwner;
        string traceabilityCode;
        string ipfsCid;
        uint256 weight;
        uint256 createdAt;
    }

    mapping(string => CoffeeBatch) private batches;
    address public userRegistryAddress;

    event BatchCreated(string batchId, string traceabilityCode, address indexed creator);
    event BatchStatusUpdated(string batchId, BatchStatus status);
    event BatchOwnershipTransferred(string batchId, address indexed from, address indexed to);

    modifier onlyActiveUser() {
        require(IUserRegistry(userRegistryAddress).isActive(msg.sender), "Tai khoan dang bi khoa hoac khong ton tai");
        _;
    }

    modifier onlyBatchOwner(string memory _batchId) {
        require(batches[_batchId].currentOwner == msg.sender, "Ban khong phai chu so huu lo hang nay");
        _;
    }

    constructor(address _userRegistry) {
        userRegistryAddress = _userRegistry;
    }

    function createBatch(string memory _batchId, string memory _traceabilityCode, string memory _ipfsCid, uint256 _weight) public onlyActiveUser {
        require(IUserRegistry(userRegistryAddress).hasRole(msg.sender, 1), "Chi Nong Dan (FARMER) moi duoc tao lo hang");
        require(batches[_batchId].createdAt == 0, "Lo hang nay da duoc khoi tao truoc do");

        batches[_batchId] = CoffeeBatch({
            batchId: _batchId,
            status: BatchStatus.INITIAL,
            currentOwner: msg.sender,
            traceabilityCode: _traceabilityCode,
            ipfsCid: _ipfsCid,
            weight: _weight,
            createdAt: block.timestamp
        });

        emit BatchCreated(_batchId, _traceabilityCode, msg.sender);
    }

    function updateBatchStatus(string memory _batchId, BatchStatus _newStatus) public onlyBatchOwner(_batchId) onlyActiveUser {
        batches[_batchId].status = _newStatus;
        emit BatchStatusUpdated(_batchId, _newStatus);
    }

    function transferBatchOwnership(string memory _batchId, address _to) public onlyBatchOwner(_batchId) onlyActiveUser {
        require(_to != address(0), "Dia chi nhan khong hop le");
        require(IUserRegistry(userRegistryAddress).isActive(_to), "Ben nhan hien tai dang bi khoa hoac chua dang ky");
        
        address oldOwner = msg.sender;
        batches[_batchId].currentOwner = _to;
        batches[_batchId].status = BatchStatus.PRE_PROCESSED;

        emit BatchOwnershipTransferred(_batchId, oldOwner, _to);
    }

    function getBatch(string memory _batchId) public view returns (CoffeeBatch memory) {
        require(batches[_batchId].createdAt != 0, "Lo hang khong ton tai");
        return batches[_batchId];
    }
}