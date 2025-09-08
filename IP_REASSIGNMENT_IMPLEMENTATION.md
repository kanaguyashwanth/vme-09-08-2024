# IP Reassignment Feature Implementation

## Overview
Successfully implemented IP reassignment functionality for Windows VMs in the post-migration tab as requested. The feature allows users to change the IP address of migrated VMs via SSH connection.

## Components Implemented

### 1. Backend (FastAPI) - `backend/main.py`
- **New Model**: `IpReassignmentRequest` - handles IP reassignment request data
- **Helper Functions**:
  - `get_interface_details()` - extracts network interface configuration from Windows VM
  - `change_ip_address()` - executes netsh command to change IP address
- **New Endpoint**: `POST /api/vms/reassign-ip` - handles IP reassignment requests

### 2. Frontend Types - `src/types/index.ts`
- Added `ipReassignmentStatus` field to `VirtualMachine` type
- Added `newTargetIp` field to track the new IP address

### 3. Context - `src/context/AppContext.tsx`
- **New Function**: `reassignVmIp()` - handles IP reassignment with validation and error handling
- Added to context interface and provider value

### 4. UI Component - `src/components/waves/ip-reassignment-table.tsx`
- **New Component**: `IpReassignmentTable` - displays VM data in requested table format
- **Columns**: VM Name, Source VM IP, Target VM IP, Guest OS, Status, Action
- **Features**:
  - IP address validation (regex-based)
  - Status indicators (pending, running, success, failed)
  - Dialog for IP input
  - Only supports Windows VMs (as requested)

### 5. Wave Details Integration - `src/components/waves/wave-details.tsx`
- Updated post-migration tab to include IP reassignment section
- Added "Perform" button that shows the table with VM details
- Integrated with existing wave management system

## Key Features

### ✅ Requirements Met
1. **Post-Migration Tab**: Added to the existing post-migration workflow
2. **Table Structure**: Exactly as requested with columns: VM Name, Source VM IP, Target VM IP, Guest OS, Status, Action
3. **Perform Button**: Shows table with VM information first
4. **Windows Logic**: Implements the provided Python script logic for Windows IP changes
5. **SSH Connection**: Uses paramiko for secure SSH connections
6. **Network Detection**: Automatically detects interface, subnet mask, and gateway
7. **Status Tracking**: Real-time status updates (pending → running → success/failed)

### 🔧 Technical Implementation
- **Backend**: FastAPI with paramiko SSH client
- **Frontend**: React with TypeScript, using shadcn/ui components
- **State Management**: React Context API
- **Validation**: IP address format validation
- **Error Handling**: Comprehensive error handling with user feedback
- **UI/UX**: Consistent with existing design patterns

### 🎯 Usage Flow
1. Navigate to Wave Details → Post-Migration tab
2. Click "Perform" button next to "IP Re-Assignment" section
3. Table displays with all VMs and their current network information
4. Click "Change IP" action button for Windows VMs
5. Enter new IP address in dialog
6. System connects via SSH and changes the IP using netsh commands
7. Status updates in real-time (running → success/failed)

### ⚠️ Limitations & Notes
- **Windows Only**: Only supports Windows VMs (as requested)
- **SSH Requirement**: Requires SSH access to target VMs
- **Credentials**: Uses existing liveSyncUsername/liveSyncPassword from VM configuration
- **Network Requirements**: VM must be accessible via current IP for the change to work

## Files Modified/Created
- `backend/main.py` - Added IP reassignment endpoint and logic
- `src/types/index.ts` - Updated VM type with IP reassignment fields
- `src/context/AppContext.tsx` - Added IP reassignment context function
- `src/components/waves/ip-reassignment-table.tsx` - New table component
- `src/components/waves/wave-details.tsx` - Integrated IP reassignment section

The implementation is complete and ready for testing. Users can now manage IP addresses for Windows VMs in the post-migration workflow exactly as specified in the requirements.
