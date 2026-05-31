pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract CoffeeTraceability is AccessControl {
    bytes32 public constant FARMER_ROLE = keccak256("FARMER_ROLE");
    bytes32 public constant COOPERATIVE_ROLE = keccak256("COOPERATIVE_ROLE");
    bytes32 public constant PROCESSOR_ROLE = keccak256("PROCESSOR_ROLE");
    bytes32 public constant EXPORTER_ROLE = keccak256("EXPORTER_ROLE");
    bytes32 public constant ROASTERY_ROLE = keccak256("ROASTERY_ROLE");

    enum LotStatus {
        Created,
        Harvested,
        Processed,
        Rejected,
        Roasted,
        Exported,
        Received
    }

    struct FarmData {
        string gpsCoordinates;
        uint256 elevation;
        string coffeeVariety;
        string cultivationMethod;
    }

    struct HarvestData {
        uint256 harvestDate;
        string harvestMethod;
        uint256 actualYield;
        string ipfsHash;
    }

    struct SupplyChainLot {
        uint256 id;
        string qrCodeIdentifier;
        LotStatus status;
        address currentActor;
        address farmerAddress;
        FarmData farmDetails;
        HarvestData harvestDetails;
        uint256 createdAt;
    }

    uint256 private _lotIdCounter;
    mapping(uint256 => SupplyChainLot) public supplyChainLots;

    event LotCreated(
        uint256 indexed lotId,
        address indexed farmerAddress,
        string gpsCoordinates,
        string qrCodeIdentifier
    );

    event LotStatusUpdated(
        uint256 indexed lotId,
        LotStatus newStatus,
        address indexed actor
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    modifier onlyLotOwner(uint256 lotId) {
        require(
            supplyChainLots[lotId].farmerAddress == msg.sender,
            "CoffeeTraceability: Caller is not the lot owner"
        );
        _;
    }

    modifier inStatus(uint256 lotId, LotStatus expected) {
        require(
            supplyChainLots[lotId].status == expected,
            "CoffeeTraceability: Invalid lot status for this operation"
        );
        _;
    }

    function createCoffeeLot(
        FarmData calldata farmData,
        string calldata qrCode
    ) external onlyRole(FARMER_ROLE) {
        _lotIdCounter++;
        uint256 newLotId = _lotIdCounter;

        supplyChainLots[newLotId] = SupplyChainLot({
            id: newLotId,
            qrCodeIdentifier: qrCode,
            status: LotStatus.Created,
            currentActor: msg.sender,
            farmerAddress: msg.sender,
            farmDetails: farmData,
            harvestDetails: HarvestData({
                harvestDate: 0,
                harvestMethod: "",
                actualYield: 0,
                ipfsHash: ""
            }),
            createdAt: block.timestamp
        });

        emit LotCreated(newLotId, msg.sender, farmData.gpsCoordinates, qrCode);
    }

    function updateHarvestInfo(
        uint256 lotId,
        uint256 harvestDate,
        string calldata harvestMethod,
        uint256 actualYield,
        string calldata ipfsHash
    ) external inStatus(lotId, LotStatus.Created) onlyLotOwner(lotId) {
        require(harvestDate > 0, "CoffeeTraceability: harvestDate must be > 0");
        require(actualYield > 0, "CoffeeTraceability: actualYield must be > 0");
        require(bytes(ipfsHash).length > 0, "CoffeeTraceability: ipfsHash required");

        SupplyChainLot storage lot = supplyChainLots[lotId];
        lot.harvestDetails = HarvestData({
            harvestDate: harvestDate,
            harvestMethod: harvestMethod,
            actualYield: actualYield,
            ipfsHash: ipfsHash
        });
        lot.status = LotStatus.Harvested;

        emit LotStatusUpdated(lotId, LotStatus.Harvested, msg.sender);
    }

    function getLot(uint256 lotId) external view returns (SupplyChainLot memory) {
        require(lotId > 0 && lotId <= _lotIdCounter, "CoffeeTraceability: Lot does not exist");
        return supplyChainLots[lotId];
    }

    function getTotalLots() external view returns (uint256) {
        return _lotIdCounter;
    }
}
