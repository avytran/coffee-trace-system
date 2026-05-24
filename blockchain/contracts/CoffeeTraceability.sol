// SPDX-License-Identifier: MIT
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
        string ipfsEvidenceHash;   
    }

    struct HarvestData {
        uint256 harvestDate;       
        string harvestMethod;      
    }

    struct ProcessingData {
        string processMethod;      
        uint256 fermentationTime;  
        uint256 moistureContent;   
        uint256 impurityRate;      
        string ipfsReportHash;     
    }

    struct RoastingData {
        string roastProfile;       
        uint256 roastBatchSize;    
        uint256 cuppingScore;      
        string qualityGrade;       
    }

    struct ExportData {
        string containerId;        
        string exportPort;         
        string certifications;     
        uint256 exportTimestamp;   
    }

    struct SupplyChainLot {
        uint256 id;                
        string qrCodeIdentifier;   
        LotStatus status;          
        address currentActor;      
        address farmerAddress;     
        
        FarmData farmDetails;
        HarvestData harvestDetails;
        ProcessingData processingDetails;
        RoastingData roastingDetails;
        ExportData exportDetails;
    }

    uint256 private _lotIdCounter;
    mapping(uint256 => SupplyChainLot) public coffeeLots;
    mapping(string => uint256) public qrToLotId; 

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function grantAgentRole(bytes32 role, address account) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid address: cannot grant to zero address");
        grantRole(role, account);
    }

    function revokeAgentRole(bytes32 role, address account) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid address: cannot revoke from zero address");
        revokeRole(role, account);
    }
}