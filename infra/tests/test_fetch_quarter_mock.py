"""
Test fetch_quarter.py logic using mocks (no Docker, no AWS calls).
Run with: pytest tests/test_fetch_quarter_mock.py -v
"""
import pytest
import json
from unittest.mock import Mock, MagicMock, patch
import sys
import os

# Add src to path so we can import modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'infra', 'src'))


def test_process_fetch_item_not_found():
    """Test: when job not in DDB, process_fetch returns early"""
    # Mock DDB table
    with patch('fetch_quarter.DDB') as mock_ddb:
        mock_ddb.get_item.return_value = {"Item": None}
        
        # Import after patching
        from fetch_quarter import process_fetch
        
        msg = {
            "jobId": "missing-job",
            "quarter": "Q1",
            "start": 1704067200,
            "end": 1711929600
        }
        
        # Should return early with no exception
        process_fetch(msg)
        mock_ddb.get_item.assert_called_once()


def test_process_fetch_no_puuid():
    """Test: when Riot API returns no puuid, job is marked as error"""
    with patch('fetch_quarter.DDB') as mock_ddb, \
         patch('fetch_quarter.get_puuid') as mock_get_puuid, \
         patch('fetch_quarter.to_regional') as mock_to_regional, \
         patch('fetch_quarter.parse_riot_id') as mock_parse, \
         patch('fetch_quarter.update_job') as mock_update:
        
        # Setup mocks
        mock_ddb.get_item.return_value = {
            "Item": {
                "jobId": "test-job",
                "platform": "euw1",
                "riotId": "Player#1234",
                "s3Base": "test-job/",
                "quarters": {"Q1": "pending"}
            }
        }
        mock_to_regional.return_value = "europe"
        mock_parse.return_value = ("Player", "1234")
        mock_get_puuid.return_value = None  # No PUUID found
        
        from fetch_quarter import process_fetch
        
        msg = {
            "jobId": "test-job",
            "quarter": "Q1",
            "start": 1704067200,
            "end": 1711929600
        }
        
        process_fetch(msg)
        
        # Should update job to mark quarter as error
        mock_update.assert_called()
        call_kwargs = mock_update.call_args[1]
        assert call_kwargs["quarters"]["Q1"] == "error"


def test_create_job_success():
    """Test: create_job writes to DDB and enqueues fetch tasks"""
    with patch('api.TABLE') as mock_table, \
         patch('api.SQS') as mock_sqs, \
         patch('api.datetime') as mock_datetime:
        
        # Mock datetime
        mock_datetime.now.return_value = MagicMock()
        
        # Import and test
        from api import create_job
        
        body = {
            "platform": "euw1",
            "riotId": "Player#1234",
            "archetype": "explorer"
        }
        
        result = create_job(body)
        
        # Should write item to DDB
        mock_table.put_item.assert_called_once()
        item = mock_table.put_item.call_args[1]["Item"]
        assert item["platform"] == "euw1"
        assert item["riotId"] == "Player#1234"
        assert item["status"] == "queued"


def test_create_job_missing_params():
    """Test: create_job rejects missing platform or riotId"""
    with patch('api.TABLE') as mock_table:
        from api import create_job, _resp
        
        # Missing platform
        body = {"riotId": "Player#1234"}
        result = create_job(body)
        assert result[0] == 400  # statusCode
        assert "platform" in result[2]  # body contains error
        
        # Missing riotId
        body = {"platform": "euw1"}
        result = create_job(body)
        assert result[0] == 400


def test_handler_post_journey():
    """Test: handler routes POST /journey to create_job"""
    with patch('api.create_job') as mock_create:
        mock_create.return_value = (200, {}, '{"jobId": "123"}')
        
        from api import handler
        
        event = {
            "requestContext": {"http": {"method": "POST"}},
            "rawPath": "/journey",
            "body": '{"platform": "euw1", "riotId": "Player#1234"}'
        }
        
        handler(event, None)
        mock_create.assert_called_once()


def test_handler_get_journey():
    """Test: handler routes GET /journey/{id} to get_job"""
    with patch('api.TABLE') as mock_table:
        mock_table.get_item.return_value = {
            "Item": {"jobId": "test-123", "status": "queued"}
        }
        
        from api import handler
        
        event = {
            "requestContext": {"http": {"method": "GET"}},
            "rawPath": "/journey/test-123",
            "body": None
        }
        
        result = handler(event, None)
        assert result[0] == 200  # statusCode
        mock_table.get_item.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
