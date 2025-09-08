# Linux IP Reassignment Implementation

## Overview
Successfully extended the IP reassignment functionality to support Linux VMs in addition to Windows VMs. The implementation uses the provided Python script logic for handling various Linux distributions.

## Components Updated

### 1. Backend Dependencies - `backend/requirements.txt`
- **Added**: `pyyaml` - Required for parsing and modifying Ubuntu netplan YAML configurations

### 2. Backend Logic - `backend/main.py`
- **Updated Model**: `IpReassignmentRequest` now includes `os_type` parameter
- **New Linux Functions**:
  - `ssh_exec()` - Execute SSH commands and return output/error
  - `detect_distro()` - Detect Linux distribution from /etc/os-release
  - `get_linux_network_details()` - Extract interface, gateway, and prefix using `ip route` and `ip addr`
  - `update_linux_ip_address()` - Update IP based on distribution type

### 3. Distribution Support
- **Ubuntu**: Updates `/etc/netplan/*.yaml` files and applies with `netplan apply`
- **Debian**: Updates `/etc/network/interfaces` and restarts networking
- **RHEL/CentOS/Oracle**: Uses NetworkManager (`nmcli`) commands
- **SUSE**: Uses NetworkManager (`nmcli`) commands
- **Unknown**: Returns error for unsupported distributions

### 4. Frontend Context - `src/context/AppContext.tsx`
- **Updated Validation**: Now accepts both Windows and Linux VMs
- **API Call**: Includes `os_type` parameter in the request payload
- **Error Handling**: Updated messages to reflect multi-OS support

### 5. UI Component - `src/components/waves/ip-reassignment-table.tsx`
- **Button Logic**: Enables both Windows and Linux VMs
- **Dialog**: Shows OS type in the description
- **Status**: Works with both operating systems

## Technical Implementation Details

### Linux Distribution Handling

#### Ubuntu (Netplan)
```yaml
network:
  ethernets:
    interface_name:
      dhcp4: false
      addresses: ["new_ip/prefix"]
      gateway4: "gateway_ip"
```

#### Debian (interfaces file)
```
auto interface_name
iface interface_name inet static
    address new_ip
    gateway gateway_ip
```

#### RHEL/CentOS/SUSE (NetworkManager)
```bash
nmcli con mod interface_name ipv4.addresses new_ip/prefix
nmcli con mod interface_name ipv4.method manual
nmcli con mod interface_name ipv4.gateway gateway_ip
nmcli con up interface_name
```

### Network Discovery Process
1. **Find Default Interface**: `ip route | grep default`
2. **Extract Gateway**: From default route output
3. **Get IP Prefix**: `ip -o -f inet addr show dev interface`
4. **Parse Configuration**: Distribution-specific config file parsing

### Security & File Handling
- **Temporary Files**: Uses Python's `tempfile` module for safe file operations
- **SFTP Transfer**: Secure file transfer for configuration updates
- **Sudo Commands**: Properly handles elevated privileges where needed
- **Cleanup**: Automatic cleanup of temporary files

## Key Features Added

### ✅ Multi-Distribution Support
- **Ubuntu**: Netplan YAML configuration management
- **Debian**: Traditional interfaces file management  
- **RHEL Family**: NetworkManager integration
- **SUSE**: NetworkManager integration
- **Auto-Detection**: Automatic distribution detection

### ✅ Robust Error Handling
- **Network Detection**: Validates interface, gateway, and prefix availability
- **Config Parsing**: Handles YAML parsing errors gracefully
- **SSH Operations**: Comprehensive SSH error handling
- **File Operations**: Safe temporary file handling with cleanup

### ✅ UI Integration
- **Seamless Experience**: Same UI flow for Windows and Linux
- **OS Indication**: Shows OS type in dialog and button states
- **Status Tracking**: Unified status system for both OS types

## Usage Flow (Linux)
1. Navigate to Wave Details → Post-Migration → IP Re-Assignment
2. Click "Perform" to display VM table
3. For Linux VMs, click "Change IP" action button
4. Enter new IP address in dialog
5. System will:
   - SSH to Linux VM using existing credentials
   - Detect distribution (Ubuntu/Debian/RHEL/SUSE)
   - Extract current network configuration
   - Update appropriate configuration files
   - Apply network changes
6. Status updates in real-time

## Distribution-Specific Behavior

| Distribution | Config Method | Config File(s) | Apply Command |
|--------------|---------------|----------------|---------------|
| Ubuntu | Netplan | `/etc/netplan/*.yaml` | `netplan apply` |
| Debian | Interfaces | `/etc/network/interfaces` | `ifdown -a && ifup -a` |
| RHEL/CentOS | NetworkManager | nmcli commands | `nmcli con up` |
| SUSE | NetworkManager | nmcli commands | `nmcli con up` |

## Testing Considerations
- **SSH Access**: Ensure Linux VMs have SSH enabled and accessible
- **Sudo Rights**: User credentials should have sudo privileges for network changes
- **Network Tools**: Required tools should be installed (ip, nmcli, netplan)
- **File Permissions**: Proper permissions for configuration file access

## Error Scenarios Handled
- **Unsupported Distribution**: Clear error message for unknown Linux distributions
- **Missing Network Tools**: Error handling when required commands are unavailable
- **Permission Issues**: SSH authentication and sudo permission errors
- **Config File Issues**: YAML parsing errors, missing netplan files, etc.
- **Network Apply Failures**: Errors during network configuration application

The implementation is now complete and supports both Windows and Linux VMs with comprehensive error handling and distribution-specific logic as provided in your script.
