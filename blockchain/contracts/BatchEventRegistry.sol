// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BatchEventRegistry {
    enum ActionType { ASSIGN_ROLE, CREATE_BATCH, HARVEST, PRE_PROCESS, REJECT, PROCESS, ASSESS, EXPORT, VERIFY, TRANSFER }

    struct BatchEvent {
        string batchId;
        ActionType action;
        address actor;
        string ipfsCid;     // CID chứa JSON chi tiết của payload
        bytes32 eventHash;  // Băm toàn bộ dữ liệu tại thời điểm phát sinh để đối soát chống giả mạo độc lập
        uint256 timestamp;
    }

    mapping(string => BatchEvent[]) private batchEvents;
    address public batchRegistryAddress;

    event BatchEventAdded(string batchId, ActionType action, address indexed actor, string ipfsCid);

    constructor(address _batchRegistry) {
        batchRegistryAddress = _batchRegistry;
    }

    function addBatchEvent(
        string memory _batchId,
        ActionType _action,
        string memory _ipfsCid,
        bytes32 _eventHash
    ) public {
        // Thực hiện ghi nhận nhật ký hành trình, có thể mở rộng kiểm tra phân quyền thông qua batchRegistryAddress
        batchEvents[_batchId].push(BatchEvent({
            batchId: _batchId,
            action: _action,
            actor: msg.sender,
            ipfsCid: _ipfsCid,
            eventHash: _eventHash,
            timestamp: block.timestamp
        }));

        emit BatchEventAdded(_batchId, _action, msg.sender, _ipfsCid);
    }

    function getBatchEvents(string memory _batchId) public view returns (BatchEvent[] memory) {
        return batchEvents[_batchId];
    }

    function verifyEventHash(string memory _batchId, uint256 _index, bytes32 _checkHash) public view returns (bool) {
        require(_index < batchEvents[_batchId].length, "Index vuot qua gioi han file nhat ky");
        return batchEvents[_batchId][_index].eventHash == _checkHash;
    }
}