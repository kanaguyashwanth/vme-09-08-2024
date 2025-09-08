
import ssl
import logging
from fastapi import FastAPI, HTTPException, Response, Body, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from pyVim import connect
from pyVmomi import vim
from io import BytesIO, StringIO
import datetime
import time
import re
import contextlib
import base64
import threading
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
import paramiko
import xml.etree.ElementTree as ET
import subprocess
from urllib.parse import quote
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
import requests
import urllib3
import platform
import yaml
import tempfile
import os

# Suppress SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


# Configure logging
logging.basicConfig(level=logging.DEBUG)

app = FastAPI()

# CORS configuration
origins = [
    "http://localhost:9002",
    "http://127.0.0.1:9002",
    "http://10.203.100.44:9002",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---

class Host(BaseModel):
    id: str
    ipAddress: str
    username: str
    password: str
    morpheusFqdn: Optional[str] = None
    morpheusApiKey: Optional[str] = None

class VirtualMachine(BaseModel):
    id: str
    name: str
    powerState: str
    cpuUsage: int
    memoryUsage: int
    storageUsage: float
    ipAddress: Optional[str] = None
    hostname: Optional[str] = None
    guestOs: Optional[str] = None
    hostId: str
    cloneTaskId: Optional[str] = None
    cloneProgress: Optional[int] = None
    cloneStatus: Optional[str] = None
    cloneName: Optional[str] = None
    preparationStatus: Optional[str] = None
    preparationLogs: Optional[str] = None
    migrationStatus: Optional[str] = None
    migrationLogs: Optional[str] = None
    migrationProgress: Optional[int] = None
    targetName: Optional[str] = None
    liveSyncStatus: Optional[str] = None
    liveSyncTargetIp: Optional[str] = None
    liveSyncUsername: Optional[str] = None
    liveSyncPassword: Optional[str] = None
    liveSyncLogs: Optional[str] = None
    morpheusAgentStatus: Optional[str] = None
    pingStatus: Optional[str] = None
    sourceFileCount: Optional[int] = None
    targetFileCount: Optional[int] = None
    chkdskReport: Optional[dict] = None
    shutdownStatus: Optional[str] = None


class PreCheckRequest(BaseModel):
    host: Host
    vmNames: List[str]

class CloneRequest(BaseModel):
    host: Host
    vmName: str

class TaskCheckRequest(Host):
    pass

class PrepareCloneRequest(BaseModel):
    host: Host
    cloneVmName: str

class TargetVMRequest(BaseModel):
    sourceHost: Host
    targetHost: Host
    cloneVmName: str

class LiveSyncRequest(BaseModel):
    source_ip: str
    target_ip: str
    username: str
    password: str

class CheckVmsRequest(BaseModel):
    host: Host
    vm_names: List[str]

class WindowsLiveSyncRequest(BaseModel):
    source_ip: str
    target_ip: str
    username: str
    password: str

class InstallAgentRequest(BaseModel):
    api_key: str
    vme_host: str
    vm_name: str
    vm_username: str
    vm_password: str

class PingTestRequest(BaseModel):
    hostnames: List[str]

class FileCheckHost(BaseModel):
    ip_address: str
    username: str
    password: str

class CheckFilesRequest(BaseModel):
    hosts: List[FileCheckHost]

class WindowsCheckFilesRequest(BaseModel):
    hosts: List[FileCheckHost]


class ShutdownVmRequest(BaseModel):
    host: Host
    vmName: str

class IpReassignmentRequest(BaseModel):
    source_ip: str
    target_ip: str
    username: str
    password: str
    os_type: str  # 'Windows' or 'Linux'



# In-memory storage for migration status and IP reassignment logs (replace with a database in a real app)
migration_statuses = {}
live_sync_logs = {}
ip_reassignment_logs = {}

# --- vCenter Connection Logic ---

def get_vcenter_connection(host_details: Host):
    """Establishes a connection to vCenter and returns the service instance."""
    context = ssl._create_unverified_context()
    try:
        service_instance = connect.SmartConnect(
            host=host_details.ipAddress,
            user=host_details.username,
            pwd=host_details.password,
            sslContext=context,
            port=443
        )
        if service_instance:
            return service_instance
        else:
            raise HTTPException(status_code=401, detail="Could not connect to vCenter. Check credentials or host address.")
    except vim.fault.InvalidLogin as e:
        if "Authentication failed" in str(e.msg):
             raise HTTPException(status_code=401, detail="Authentication failed. Please check KVM host credentials.")
        raise HTTPException(status_code=401, detail="Invalid vCenter credentials provided.")
    except ConnectionRefusedError:
        raise HTTPException(status_code=503, detail=f"Connection refused by vCenter host {host_details.ipAddress}.")
    except Exception as e:
        logging.error(f"Failed to connect to vCenter: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to connect to vCenter: {e}")

def find_vm_by_name(si, vm_name):
    content = si.RetrieveContent()
    vm_view = content.viewManager.CreateContainerView(content.rootFolder, [vim.VirtualMachine], True)
    for vm in vm_view.view:
        if vm.name == vm_name:
            vm_view.Destroy()
            return vm
    vm_view.Destroy()
    return None

def find_existing_clone(si, base_vm_name):
    content = si.RetrieveContent()
    vm_view = content.viewManager.CreateContainerView(content.rootFolder, [vim.VirtualMachine], True)
    clone_prefix = f"{base_vm_name}-VME_Clone_"
    for vm in vm_view.view:
        if vm.name.startswith(clone_prefix):
            vm_view.Destroy()
            return vm
    vm_view.Destroy()
    return None

# --- Logic from user-provided script ---
@contextlib.contextmanager
def capture_output():
    log_stream = StringIO()
    _stdout = logging.getLogger().handlers[0].stream
    log_handler = logging.StreamHandler(log_stream)
    logging.getLogger().addHandler(log_handler)
    try:
        yield log_stream
    finally:
        logging.getLogger().removeHandler(log_handler)

def wait_for_task_with_logs(task, log_stream, timeout=600):
    start_time = time.time()
    while task.info.state in [vim.TaskInfo.State.queued, vim.TaskInfo.State.running]:
        if time.time() - start_time > timeout:
            raise Exception(f"Task timed out after {timeout} seconds.")
        log_stream.write(f"Task state: {task.info.state} (elapsed: {int(time.time() - start_time)}s)\n")
        time.sleep(2)

    if task.info.state == vim.TaskInfo.State.success:
        log_stream.write("Task completed successfully.\n")
        return True
    else:
        error_msg = task.info.error.msg if task.info.error else "Unknown error."
        raise Exception(f"Task failed: {error_msg}")

def disable_nic_connect_at_power_on(vm, log_stream):
    vm_config_spec = vim.vm.ConfigSpec()
    device_changes = []
    for device in vm.config.hardware.device:
        if isinstance(device, vim.vm.device.VirtualEthernetCard):
            nic_spec = vim.vm.device.VirtualDeviceSpec()
            nic_spec.operation = vim.vm.device.VirtualDeviceSpec.Operation.edit
            nic_spec.device = device
            nic_spec.device.connectable.startConnected = False
            device_changes.append(nic_spec)
            log_stream.write(f"Prepared update for network adapter '{device.deviceInfo.label}' to disable 'Connect at Power On'.\n")

    if not device_changes:
        log_stream.write(f"No network adapters found to modify for VM '{vm.name}'.\n")
        return False

    vm_config_spec.deviceChange = device_changes
    log_stream.write(f"Initiating reconfiguration for VM '{vm.name}'...\n")
    task = vm.ReconfigVM_Task(spec=vm_config_spec)
    wait_for_task_with_logs(task, log_stream)
    log_stream.write(f"Successfully disabled 'Connect at Power On' for all network adapters of VM '{vm.name}'.\n")
    return True

def power_on_vm_and_wait_for_tools(vm, log_stream, timeout=600):
    if vm.runtime.powerState == vim.VirtualMachinePowerState.poweredOn:
        log_stream.write(f"VM '{vm.name}' is already powered on.\n")
        return True
    
    log_stream.write(f"Powering on VM '{vm.name}'...\n")
    task = vm.PowerOnVM_Task()
    wait_for_task_with_logs(task, log_stream)

    log_stream.write(f"Waiting for VM '{vm.name}' to boot (VMware Tools running)...\n")
    start_time = time.time()
    while vm.guest.toolsRunningStatus != "guestToolsRunning":
        if time.time() - start_time > timeout:
            raise Exception(f"Timeout waiting for VMware Tools on '{vm.name}'.")
        log_stream.write(f"VMware Tools status: {vm.guest.toolsRunningStatus} (elapsed: {int(time.time() - start_time)}s)\n")
        time.sleep(5)
    
    log_stream.write(f"VM '{vm.name}' is powered on and VMware Tools is running.\n")
    return True

def shutdown_vm_gracefully(vm, log_stream, timeout=600):
    if vm.runtime.powerState != vim.VirtualMachinePowerState.poweredOn:
        log_stream.write(f"VM '{vm.name}' is not powered on. Cannot initiate shutdown.\n")
        return False
    if vm.guest.toolsRunningStatus != "guestToolsRunning":
        log_stream.write(f"VMware Tools not running on '{vm.name}'. Cannot initiate graceful shutdown.\n")
        return False
    
    log_stream.write(f"Initiating graceful shutdown of VM '{vm.name}'...\n")
    vm.ShutdownGuest()

    start_time = time.time()
    while vm.runtime.powerState != vim.VirtualMachinePowerState.poweredOff:
        if time.time() - start_time > timeout:
            raise Exception(f"Timeout waiting for VM '{vm.name}' to power off.")
        log_stream.write(f"Power state: {vm.runtime.powerState} (elapsed: {int(time.time() - start_time)}s)\n")
        time.sleep(5)
    
    log_stream.write(f"VM '{vm.name}' has been gracefully shut down.\n")
    return True

# --- API Endpoints ---

@app.get("/")
def read_root():
    return {"message": "VME Migrate Backend is running."}

@app.post("/api/vms", response_model=list[VirtualMachine])
async def get_vms_from_host(host: Host):
    logging.debug(f"Received payload for get_vms_from_host: {host.ipAddress}")
    service_instance = None
    vm_list = []
    
    try:
        service_instance = get_vcenter_connection(host)
        content = service_instance.RetrieveContent()
        container = content.rootFolder
        view_type = [vim.VirtualMachine]
        recursive = True
        container_view = content.viewManager.CreateContainerView(container, view_type, recursive)
        
        for vm in container_view.view:
            summary = vm.summary
            stats = summary.quickStats
            guest = summary.guest
            storage_gb = round((summary.storage.committed + summary.storage.uncommitted) / (1024**3), 2)
            
            vm_details = {
                "id": vm._moId,
                "name": summary.config.name,
                "powerState": summary.runtime.powerState,
                "cpuUsage": stats.overallCpuUsage,
                "memoryUsage": stats.guestMemoryUsage,
                "storageUsage": storage_gb,
                "ipAddress": guest.ipAddress if guest and guest.ipAddress else "N/A",
                "hostname": guest.hostName if guest and guest.hostName else "N/A",
                "guestOs": guest.guestFullName if guest else "N/A",
                "hostId": host.id
            }
            vm_list.append(vm_details)
        
        container_view.Destroy()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred while fetching VMs: {str(e)}")
    finally:
        if service_instance:
            connect.Disconnect(service_instance)
    return vm_list

def gather_vsphere_info(vcenter, user, pwd, vm_names):
    ssl_context = ssl._create_unverified_context()
    si = connect.SmartConnect(host=vcenter, user=user, pwd=pwd, port=443, sslContext=ssl_context)
    content = si.RetrieveContent()
    view = content.viewManager.CreateContainerView(content.rootFolder, [vim.VirtualMachine], True)
    vms = {vm.name: vm for vm in view.view}
    view.Destroy()
    results = {}
    for name in vm_names:
        vm = vms.get(name)
        if not vm:
            results[name] = None
            continue
        s = vm.summary
        info = {
            "Name": s.config.name,
            "Host": vm.runtime.host.name,
            "PowerState": vm.runtime.powerState,
            "vCPUs": s.config.numCpu,
            "MemoryMB": s.config.memorySizeMB,
            "Datastores": ", ".join(ds.name for ds in vm.datastore)
        }
        if s.guest and s.guest.toolsRunningStatus == "guestToolsRunning":
            info.update({
                "GuestOS": s.guest.guestFullName,
                "Hostname": s.guest.hostName,
                "IP": s.guest.ipAddress
            })
        else:
            info.update({"GuestOS": "N/A", "Hostname": "N/A", "IP": "N/A"})
        results[name] = info
    connect.Disconnect(si)
    return results

@app.post("/api/precheck-report")
async def generate_precheck_report(request: PreCheckRequest):
    logging.debug(f"Generating pre-check report for {len(request.vmNames)} VMs on host {request.host.ipAddress}")
    try:
        vs_data = gather_vsphere_info(request.host.ipAddress, request.host.username, request.host.password, request.vmNames)
        report_data = [info for info in vs_data.values() if info]

        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                                leftMargin=36, rightMargin=36,
                                topMargin=36, bottomMargin=36)
        styles = getSampleStyleSheet()
        # Adjust styles for table
        header_style = styles['Heading4']
        header_style.fontSize = 9
        header_style.leading = 10
        body_style = styles['BodyText']
        body_style.fontSize = 8
        body_style.leading = 10
        body_style.wordWrap = 'CJK' # enable wrapping
        elements = []
        elements.append(Paragraph("VM Inventory Report", styles['Title']))
        elements.append(Spacer(1, 12))
        headers = ["Name", "Host/Host IP", "PowerState", "GuestOS", "Hostname", "IP", "vCPUs", "MemoryMB", "Datastores"]
        table_data = []
        # Wrap headers in Paragraphs
        table_data.append([Paragraph(h, header_style) for h in headers])
        for row in report_data:
            cells = []
            for key in ["Name", "Host", "PowerState", "GuestOS", "Hostname", "IP", "vCPUs", "MemoryMB", "Datastores"]:
                cells.append(Paragraph(str(row.get(key, "")), body_style))
            table_data.append(cells)
        col_count = len(headers)
        table_width = doc.width
        col_widths = [table_width / col_count] * col_count
        t = Table(table_data, colWidths=col_widths, repeatRows=1)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.grey),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('ALIGN',(0,0),(-1,0),'CENTER'),
            ('VALIGN',(0,0),(-1,-1),'TOP'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.black),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold')
        ]))
        elements.append(t)
        doc.build(elements)
        buffer.seek(0)
        
        return Response(content=buffer.getvalue(), media_type="application/pdf")

    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error generating report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/vms/clone")
async def clone_vm(request: CloneRequest):
    logging.debug(f"Received clone request for VM: {request.vmName} on host {request.host.ipAddress}")
    si = None
    try:
        si = get_vcenter_connection(request.host)
        
        existing_clone = find_existing_clone(si, request.vmName)
        if existing_clone:
            return {"status": "already_exists", "cloneName": existing_clone.name, "message": f"Clone for {request.vmName} already exists."}

        vm_to_clone = find_vm_by_name(si, request.vmName)

        if not vm_to_clone:
            raise HTTPException(status_code=404, detail=f"VM '{request.vmName}' not found.")
        
        if vm_to_clone.runtime.powerState != 'poweredOn':
            raise HTTPException(status_code=400, detail=f"VM '{request.vmName}' is not powered on. Skipping clone.")

        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        clone_name = f"{request.vmName}-VME_Clone_{timestamp}"

        relospec = vim.vm.RelocateSpec()
        relospec.datastore = vm_to_clone.datastore[0] if vm_to_clone.datastore else None
        
        clonespec = vim.vm.CloneSpec()
        clonespec.location = relospec
        clonespec.powerOn = False
        clonespec.template = False
        
        logging.info(f"Initiating clone for VM '{request.vmName}' to '{clone_name}'...")
        task = vm_to_clone.CloneVM_Task(folder=vm_to_clone.parent, name=clone_name, spec=clonespec)
        
        return {"taskId": task._moId, "cloneName": clone_name, "message": f"Cloning process started for {request.vmName}."}
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error cloning VM {request.vmName}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if si:
            connect.Disconnect(si)

@app.post("/api/tasks/{task_id}")
async def get_task_progress(task_id: str, request: TaskCheckRequest = Body(...)):
    si = None
    try:
        si = get_vcenter_connection(request)
        task = vim.Task(task_id, si._stub)
        
        if task.info.state == vim.TaskInfo.State.error:
            error_message = str(task.info.error.localizedMessage) if task.info.error.localizedMessage else "An unknown error occurred during the task."
            raise HTTPException(status_code=500, detail=error_message)

        return {"state": task.info.state, "progress": task.info.progress or 0}

    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error fetching task progress for task {task_id}: {e}")
        if "The object has already been deleted or has not been completely created" in str(e):
             raise HTTPException(status_code=404, detail="Task not found. It might be completed or invalid.")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if si:
            connect.Disconnect(si)

def run_preparation_task(host: Host, clone_vm_name: str):
    """The actual long-running preparation task."""
    si = None
    log_stream = StringIO()
    vm_name = clone_vm_name # For status updates
    try:
        update_migration_status(vm_name, "running", logs="Starting preparation...")
        si = get_vcenter_connection(host)
        
        log_stream.write(f"Searching for VM clone '{clone_vm_name}'...\n")
        update_migration_status(vm_name, "running", logs=log_stream.getvalue())
        vm = find_vm_by_name(si, clone_vm_name)
        if vm is None:
            raise Exception(f"VM clone '{clone_vm_name}' not found.")
        update_migration_status(vm_name, "running", logs=log_stream.getvalue())

        log_stream.write(f"VM found. Current power state: {vm.runtime.powerState}\n")
        update_migration_status(vm_name, "running", logs=log_stream.getvalue())
        if vm.runtime.powerState != vim.VirtualMachinePowerState.poweredOff:
            shutdown_vm_gracefully(vm, log_stream)
            update_migration_status(vm_name, "running", logs=log_stream.getvalue())

        if not disable_nic_connect_at_power_on(vm, log_stream):
            raise Exception("Failed to disable 'Connect at Power On'.")
        update_migration_status(vm_name, "running", logs=log_stream.getvalue())

        if not power_on_vm_and_wait_for_tools(vm, log_stream):
            raise Exception("Failed to power on VM.")
        update_migration_status(vm_name, "running", logs=log_stream.getvalue())

        if not shutdown_vm_gracefully(vm, log_stream):
            raise Exception("Failed to shut down VM.")
        update_migration_status(vm_name, "running", logs=log_stream.getvalue())

        log_stream.write("VM preparation complete.\n")
        update_migration_status(vm_name, "success", logs=log_stream.getvalue())

    except Exception as e:
        log_stream.write(f"An unexpected error occurred: {str(e)}\n")
        update_migration_status(vm_name, "error", logs=log_stream.getvalue())
    finally:
        if si:
            connect.Disconnect(si)
        log_stream.close()


@app.post("/api/vms/prepare-for-target")
async def prepare_clone_for_target(request: PrepareCloneRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_preparation_task, request.host, request.cloneVmName)
    return {"status": "started", "message": f"Preparation process for {request.cloneVmName} has been initiated."}


# --- virt-v2v Migration Logic ---

def update_ip_reassignment_logs(vm_ip, log_message):
    """Update IP reassignment logs for real-time display."""
    if vm_ip not in ip_reassignment_logs:
        ip_reassignment_logs[vm_ip] = []
    
    ip_reassignment_logs[vm_ip].append(log_message)
    logging.info(f"IP Reassignment [{vm_ip}]: {log_message}")

def update_migration_status(vm_name, status, progress=0, logs=""):
    # This function now handles both preparation and migration statuses
    if vm_name not in migration_statuses:
        migration_statuses[vm_name] = {}

    if status in ["success", "error", "running"]:
        migration_statuses[vm_name]["status"] = status
    
    if logs:
        # For running status, we want to show the latest line, not the full log.
        if status == "running" and "\n" in logs:
             migration_statuses[vm_name]["logs"] = logs.strip().split('\n')[-1]
        else:
             migration_statuses[vm_name]["logs"] = logs
    
    if progress is not None:
         migration_statuses[vm_name]["progress"] = progress


def get_ssh_client(hostname, username, password):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname, username=username, password=password, timeout=10)
    return client

def fetch_thumbprint(kvm_client, vcenter_host):
    command = f"openssl s_client -connect {vcenter_host}:443 </dev/null 2>/dev/null | openssl x509 -fingerprint -sha1 -noout"
    stdin, stdout, stderr = kvm_client.exec_command(command)
    output = stdout.read().decode('utf-8')
    match = re.search(r"Fingerprint=([A-F0-9:]+)", output)
    if match:
        return match.group(1)
    raise Exception("Failed to extract SHA1 fingerprint from vCenter.")

def run_virt_v2v(req: TargetVMRequest):
    vm_name = req.cloneVmName
    update_migration_status(vm_name, "running", 5, "Connecting to KVM host...")
    try:
        kvm_client = get_ssh_client(req.targetHost.ipAddress, req.targetHost.username, req.targetHost.password)
        
        update_migration_status(vm_name, "running", 10, "Fetching vCenter thumbprint...")
        thumbprint = fetch_thumbprint(kvm_client, req.sourceHost.ipAddress)
        
        datastore_path = "/mnt/24445c14-4be6-49c7-91d4-f6e1b0a264c7"
        vddk_libdir = "/opt/vmware-vix-disklib-distrib"
        vcenter_path = "/vme-vc/10.55.175.0"
        
        temp_pass_file = f"/tmp/v2v-pass-{vm_name}"
        kvm_client.exec_command(f"echo '{req.sourceHost.password}' > {temp_pass_file}; chmod 600 {temp_pass_file}")
        
        encoded_username = quote(req.sourceHost.username)

        # Extract base name for the output directory and VM name
        base_vm_name_match = re.match(r"(.*?)-VME_Clone_\d{14}", vm_name)
        if not base_vm_name_match:
            raise Exception(f"Could not determine base name from clone '{vm_name}'")
        base_vm_name = base_vm_name_match.group(1)

        output_dir = f"{datastore_path}/{base_vm_name}"
        kvm_client.exec_command(f"mkdir -p {output_dir}")

        v2v_command = (
            f"virt-v2v -ic 'vpx://{encoded_username}@{req.sourceHost.ipAddress}{vcenter_path}?no_verify=1' "
            f"-ip {temp_pass_file} \"{vm_name}\" -on \"{base_vm_name}\" -o local -os {output_dir} -of qcow2 "
            f"-it vddk -io vddk-libdir={vddk_libdir} -io vddk-thumbprint={thumbprint}"
        )
        
        update_migration_status(vm_name, "running", 20, f"Starting virt-v2v migration...")
        stdin, stdout, stderr = kvm_client.exec_command(v2v_command, get_pty=True)

        # Real-time log streaming
        while not stdout.channel.exit_status_ready():
            line = stdout.readline()
            if line:
                # Update status with the latest line from virt-v2v
                update_migration_status(vm_name, "running", 30, f"v2v: {line.strip()}")
            time.sleep(0.1) # Small sleep to prevent busy-waiting

        exit_code = stdout.channel.recv_exit_status()
        kvm_client.exec_command(f"rm {temp_pass_file}")
        
        if exit_code == 0:
            update_migration_status(vm_name, "running", 90, "Fixing VM configuration...")
            # --- Start of post-migration script logic ---
            xml_file = f"{output_dir}/{base_vm_name}.xml"
            
            # 1. Fetch and fix XML
            s_stdin, s_stdout, s_stderr = kvm_client.exec_command(f"cat {xml_file}")
            xml_content_bytes = s_stdout.read()
            xml_content = xml_content_bytes.decode('utf-8')
            stderr_output = s_stderr.read().decode('utf-8')

            if stderr_output: raise Exception(f"Could not read XML file: {stderr_output}")

            tree = ET.ElementTree(ET.fromstring(xml_content))
            root = tree.getroot()
            devices = root.find('devices')
            if devices is not None:
                disks = devices.findall('disk')
                target_to_disk = {}
                for disk in disks[:]:
                    target_elem = disk.find('target')
                    if target_elem is not None:
                        dev = target_elem.get('dev')
                        if dev:
                            source_elem = disk.find('source')
                            has_source = source_elem is not None and source_elem.get('file') is not None
                            if dev in target_to_disk:
                                prev_disk = target_to_disk[dev]
                                prev_source = prev_disk.find('source')
                                prev_has_source = prev_source is not None and prev_source.get('file') is not None
                                if not has_source: devices.remove(disk)
                                elif not prev_has_source:
                                    devices.remove(prev_disk)
                                    target_to_disk[dev] = disk
                                else: devices.remove(disk)
                            else: target_to_disk[dev] = disk
            
            # 2. Write fixed XML
            modified_xml = ET.tostring(root, encoding='unicode', method='xml')
            sftp = kvm_client.open_sftp()
            with sftp.file(xml_file, 'w') as f: f.write(modified_xml)
            sftp.close()

            # 3. Define VM
            stdin, stdout, stderr = kvm_client.exec_command(f"virsh define {xml_file}")
            stderr_output = stderr.read().decode('utf-8')
            if stderr_output: raise Exception(f"Failed to define VM: {stderr_output}")

            # 4. Modify network settings
            temp_xml_path = f"/tmp/{base_vm_name}.xml"
            network_command = (
                f"virsh dumpxml {base_vm_name} | "
                f"sed \"s/interface type='bridge'/interface type='network'/\" | "
                f"sed \"s/source bridge='VM Network'/source network='Compute'/\" > {temp_xml_path} && "
                f"virsh define {temp_xml_path}"
            )
            stdin, stdout, stderr = kvm_client.exec_command(network_command)
            stderr_output = stderr.read().decode('utf-8')
            if stderr_output: raise Exception(f"Failed to modify network settings: {stderr_output}")

            # 5. Start VM
            update_migration_status(vm_name, "running", 95, "Starting VM on target...")
            stdin, stdout, stderr = kvm_client.exec_command(f"virsh start {base_vm_name}")
            stderr_output = stderr.read().decode('utf-8')
            if stderr_output: raise Exception(f"Failed to start VM: {stderr_output}")

            update_migration_status(vm_name, "success", 100, "Migration successful. VM created and started on target.")
            # --- End of post-migration script logic ---
        else:
            error_output = stderr.read().decode('utf-8')
            full_log = stdout.read().decode('utf-8') + error_output
            raise Exception(f"virt-v2v failed with exit code {exit_code}: {full_log}")

    except Exception as e:
        update_migration_status(vm_name, "error", 0, str(e))
    finally:
        if 'kvm_client' in locals():
            kvm_client.close()

@app.post("/api/vms/create-target-vm")
async def create_target_vm(request: TargetVMRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_virt_v2v, request)
    return {"status": "started", "message": f"Migration process for {request.cloneVmName} has been initiated."}

@app.get("/api/vms/migration-status/{vm_name}")
async def get_migration_status(vm_name: str):
    status = migration_statuses.get(vm_name)
    if not status:
        raise HTTPException(status_code=404, detail="Migration status not found for this VM.")
    return status
    
@app.get("/api/vms/preparation-status/{clone_vm_name}")
async def get_preparation_status(clone_vm_name: str):
    status = migration_statuses.get(clone_vm_name)
    if not status:
        raise HTTPException(status_code=404, detail=f"Preparation status for {clone_vm_name} not found.")
    return status

# --- Live Sync Logic ---

def execute_ssh_command(host, username, password, command, log_buffer):
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(host, username=username, password=password, timeout=10)
        
        use_sudo = command.startswith('sudo ')
        actual_cmd = f'sudo -S {command[5:]}' if use_sudo else command
        
        stdin, stdout, stderr = client.exec_command(actual_cmd, get_pty=True)
        if use_sudo:
            stdin.write(password + '\n')
            stdin.flush()
            
        output = stdout.read().decode('utf-8', errors='ignore').strip()
        error = stderr.read().decode('utf-8', errors='ignore').strip()
        
        if output:
            log_buffer.write(f"Output from {host}: {output}\n")
        if error:
            log_buffer.write(f"Error from {host}: {error}\n")
            
        return output, error
    except Exception as e:
        log_buffer.write(f"Exception connecting to {host}: {str(e)}\n")
        return "", str(e)
    finally:
        if 'client' in locals() and client.get_transport() is not None and client.get_transport().is_active():
            client.close()

def setup_ssh_key(source_ip, target_ip, username, source_pass, target_pass, log_buffer):
    log_buffer.write("Checking/creating SSH key on source...\n")
    output, _ = execute_ssh_command(source_ip, username, source_pass, '[ -f ~/.ssh/id_rsa ] && echo yes || echo no', log_buffer)
    if 'yes' not in output:
        execute_ssh_command(source_ip, username, source_pass, 'ssh-keygen -t rsa -b 2048 -N "" -f ~/.ssh/id_rsa -q', log_buffer)
    
    pub_key, _ = execute_ssh_command(source_ip, username, source_pass, 'cat ~/.ssh/id_rsa.pub', log_buffer)
    if not pub_key:
        raise Exception("Failed to retrieve public key from source.")
        
    log_buffer.write("Configuring SSH key on target...\n")
    execute_ssh_command(target_ip, username, target_pass, 'mkdir -p ~/.ssh && chmod 700 ~/.ssh', log_buffer)
    append_cmd = f'echo "{pub_key}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'
    execute_ssh_command(target_ip, username, target_pass, append_cmd, log_buffer)
    
    log_buffer.write("Testing passwordless SSH from source to target...\n")
    test_cmd = f'ssh -o BatchMode=yes -o StrictHostKeyChecking=no {username}@{target_ip} "echo ok"'
    output, error = execute_ssh_command(source_ip, username, source_pass, test_cmd, log_buffer)
    
    if 'ok' in output and not error:
        log_buffer.write("Passwordless SSH setup successful.\n")
    else:
        raise Exception(f"Failed to setup passwordless SSH: {error}")


def update_lsyncd_config(source_ip, username, source_pass, target_ip, log_buffer):
    log_buffer.write("Updating lsyncd configuration on source...\n")
    config = f"""
settings {{
   logfile = "/var/log/lsyncd/lsyncd.log",
   statusFile = "/var/log/lsyncd/lsyncd.status",
   nodaemon = true,
   insist = true,
   inotifyMode = "CloseWrite",
   maxProcesses = 1,
}}
sync {{
   default.rsyncssh,
   source = "/",
   host = "{target_ip}",
   targetdir = "/",
   delay = 0,
   rsync = {{
      archive = true,
      compress = true,
      verbose = true,
      rsh = "/usr/bin/ssh -o StrictHostKeyChecking=no",
      _extra = {{
         "--delete", "--exclude-from=/etc/lsyncd.exclude"
      }},
   }}
}}
"""
    exclude_list = "/proc/\n/sys/\n/tmp/\n/run/\n/mnt/\n/media/\n/lost+found/\n/dev/\n/var/lock/\n/var/run/\n/var/tmp/\n/root/.ssh/\n/var/log/lsyncd/\n/etc/lsyncd.conf\n/etc/lsyncd.exclude\n/usr/bin/lsyncd\n/etc/systemd/system/lsyncd*\n/lib/systemd/system/lsyncd*"

    encoded_config = base64.b64encode(config.encode('utf-8')).decode('utf-8')
    execute_ssh_command(source_ip, username, source_pass, f'echo "{encoded_config}" | base64 -d | sudo tee /etc/lsyncd.conf > /dev/null', log_buffer)
    
    encoded_exclude = base64.b64encode(exclude_list.encode('utf-8')).decode('utf-8')
    execute_ssh_command(source_ip, username, source_pass, f'echo "{encoded_exclude}" | base64 -d | sudo tee /etc/lsyncd.exclude > /dev/null', log_buffer)
    log_buffer.write("lsyncd configuration updated.\n")

def run_live_sync_action(action, req: LiveSyncRequest):
    log_buffer = StringIO()
    log_key = f"{req.source_ip}-{req.target_ip}-linux"
    
    try:
        if action == "start":
            log_buffer.write("--- Starting Live Sync Setup ---\n")
            execute_ssh_command(req.source_ip, req.username, req.password, 'sudo systemctl is-active sshd', log_buffer)
            execute_ssh_command(req.target_ip, req.username, req.password, 'sudo systemctl is-active sshd', log_buffer)
            setup_ssh_key(req.source_ip, req.target_ip, req.username, req.password, req.password, log_buffer)
            execute_ssh_command(req.source_ip, req.username, req.password, 'command -v lsyncd', log_buffer)
            execute_ssh_command(req.target_ip, req.username, req.password, 'command -v rsync', log_buffer)
            update_lsyncd_config(req.source_ip, req.username, req.password, req.target_ip, log_buffer)
            log_buffer.write("--- Setup Complete, Starting Live Sync ---\n")
            execute_ssh_command(req.source_ip, req.username, req.password, 'sudo systemctl start lsyncd', log_buffer)
            log_buffer.write("lsyncd service started.\n")

        elif action == "stop":
            log_buffer.write("--- Stopping Live Sync ---\n")
            execute_ssh_command(req.source_ip, req.username, req.password, 'sudo systemctl stop lsyncd', log_buffer)
            log_buffer.write("lsyncd service stopped.\n")

        elif action == "logs":
            log_buffer.write("--- Fetching Logs ---\n")
            output, _ = execute_ssh_command(req.source_ip, req.username, req.password, 'sudo tail -n 100 /var/log/lsyncd/lsyncd.log', log_buffer)
            if not output.strip():
                log_buffer.write("Log file is empty or does not exist.\n")

    except Exception as e:
        log_buffer.write(f"\n--- An unexpected error occurred: {str(e)} ---\n")
    finally:
        live_sync_logs[log_key] = log_buffer.getvalue()
        log_buffer.close()

def run_windows_sync(req: WindowsLiveSyncRequest):
    source = req.source_ip
    clone = req.target_ip
    user = req.username
    pwd = req.password

    log_key = f"{source}-{clone}-windows"
    log_buffer = f"Initiating Robocopy sync for {source} -> {clone}...\n"
    live_sync_logs[log_key] = log_buffer
    
    ps_script = f'''
$ErrorActionPreference = "Stop"
$sourceVMIP = "{source}"
$cloneVMIP = "{clone}"
$username = "{user}"
$password = "{pwd}"
$retry = 1
$wait = 1
$driveLetters = "C", "D", "E"

function Test-NetUse {{
    param ($Path, $User, $Pass)
    try {{
        net use $Path /user:$User $Pass 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {{
            Write-Host "Successfully connected to $Path"
            return $true
        }} else {{
            Write-Host "Failed to connect to $Path"
            return $false
        }}
    }} catch {{
        Write-Host "Error connecting to $Path : $_"
        return $false
    }}
}}

if (-not (Test-NetUse "\\\\$sourceVMIP\\C$" $username $password)) {{
    Write-Error "Failed to connect to source VM C$ share"
    exit 1
}}
if (-not (Test-NetUse "\\\\$cloneVMIP\\C$" $username $password)) {{
    Write-Error "Failed to connect to target VM C$ share"
    exit 1
}}

foreach ($drive in $driveLetters) {{
    $sourcePath = "\\\\$sourceVMIP\\$drive`$"
    $targetPath = "\\\\$cloneVMIP\\$drive`$"
    Write-Host "`nSyncing $sourcePath -> $targetPath..."
    $baseOptions = @(
        "robocopy",
        "`"$sourcePath`"",
        "`"$targetPath`"",
        "/MIR",
        "/Z",
        "/R:$retry",
        "/W:$wait",
        "/COPY:DAT",
        "/DCOPY:T",
        "/FFT",
        "/LOG+:robocopy_log.txt"
    )
    if ($drive -eq "C") {{
        $baseOptions += @(
            "/XD",
                "`"$sourcePath\\Windows`"",
                "`"$sourcePath\\Program Files`"",
                "`"$sourcePath\\Program Files (x86)`"",
                "`"$sourcePath\\ProgramData`"",
                "`"$sourcePath\\System Volume Information`"",
                "`"$sourcePath\\$Recycle.Bin`"",
                "`"$sourcePath\\Recovery`"",
                "`"$sourcePath\\PerfLogs`"",
            "/XF",
                "pagefile.sys",
                "hiberfil.sys",
                "swapfile.sys",
                "DumpStack.log.tmp",
                "*.etl",
                "*.evtx",
                "*.log1"
        )
    }}
    $cmd = $baseOptions -join " "
    Write-Host "Executing: $cmd"
    try {{
        Invoke-Expression $cmd
        if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq 1) {{
            Write-Host "Robocopy completed successfully for drive $drive"
        }} else {{
            Write-Host "Robocopy failed for drive $drive with exit code $LASTEXITCODE"
        }}
    }} catch {{
        Write-Host "Error executing robocopy for drive $drive : $_"
    }}
}}
'''
    try:
        process = subprocess.Popen(
            ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_script],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            errors='replace'
        )

        while process.poll() is None:
            stdout_line = process.stdout.readline()
            if stdout_line:
                log_buffer += stdout_line
                live_sync_logs[log_key] = log_buffer
            stderr_line = process.stderr.readline()
            if stderr_line:
                log_buffer += f"Error: {stderr_line}"
                live_sync_logs[log_key] = log_buffer

        stdout, stderr = process.communicate()
        if stdout:
            log_buffer += stdout
        if stderr:
            log_buffer += f"Error: {stderr}"

        log_buffer += "\nSync process finished."
    except Exception as e:
        log_buffer += f"\nError running PowerShell script: {e}"
    finally:
        live_sync_logs[log_key] = log_buffer


@app.post("/api/vms/replication/start-windows-sync")
async def start_windows_sync(request: WindowsLiveSyncRequest, background_tasks: BackgroundTasks):
    source = request.source_ip
    clone = request.target_ip
    log_key = f"{source}-{clone}-windows"
    live_sync_logs[log_key] = f"Initiating Robocopy sync for {source} -> {clone}...\n"
    
    background_tasks.add_task(run_windows_sync, request)
    
    return {"status": "started", "message": f"Windows sync process initiated for {source} -> {clone}."}

@app.post("/api/vms/replication/check-vms")
async def check_vms_status(request: CheckVmsRequest):
    si = get_vcenter_connection(request.host)
    results = []
    try:
        for vm_name in request.vm_names:
            vm = find_vm_by_name(si, vm_name)
            if vm:
                guest_os_str = vm.summary.guest.guestFullName if vm.summary.guest else "N/A"
                os_type = "Unknown"
                if "windows" in guest_os_str.lower():
                    os_type = "Windows"
                elif "linux" in guest_os_str.lower():
                    os_type = "Linux"
                
                results.append({
                    "name": vm.name,
                    "powerState": vm.runtime.powerState, 
                    "guestOs": guest_os_str,
                    "osType": os_type
                })
            else:
                results.append({"name": vm_name, "powerState": "not present", "guestOs": "N/A", "osType": "Unknown"})
    finally:
        if si:
            connect.Disconnect(si)
    return results

@app.post("/api/vms/replication/{action}")
async def live_sync_action(action: str, request: LiveSyncRequest, background_tasks: BackgroundTasks):
    if action not in ["start", "stop", "logs"]:
        raise HTTPException(status_code=400, detail="Invalid action specified.")
    
    log_key = f"{request.source_ip}-{request.target_ip}-linux"
    live_sync_logs[log_key] = f"Initiating '{action}' action...\n"
    
    background_tasks.add_task(run_live_sync_action, action, request)
    
    return {"status": "started", "message": f"Action '{action}' initiated for {request.source_ip} -> {request.target_ip}."}

@app.get("/api/vms/replication/logs/{source_ip}/{target_ip}")
async def get_live_sync_logs(source_ip: str, target_ip: str, os_type: str = 'linux'):
    log_key = f"{source_ip}-{target_ip}-{os_type}"
    logs = live_sync_logs.get(log_key, "No logs available yet. Please initiate an action.")
    return {"logs": logs}


# --- Morpheus Agent Installation ---
@app.post("/api/vms/install-morpheus-agent")
async def install_morpheus_agent(req: InstallAgentRequest):
    BASE_URL = f"https://{req.vme_host}/api"
    headers = {
        "Authorization": f"Bearer {req.api_key}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    
    # Step 1: Find the server/VM in Morpheus
    try:
        search_url = f"{BASE_URL}/servers?max=200&name={req.vm_name}"
        response = requests.get(search_url, headers=headers, verify=False)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"Failed to fetch servers from Morpheus: {response.text}")

        servers = response.json().get("servers", [])
        target_vm = next((s for s in servers if s["name"] == req.vm_name), None)

        if not target_vm:
            raise HTTPException(status_code=404, detail=f"VM '{req.vm_name}' not found in Morpheus.")

        vm_id = target_vm["id"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error communicating with Morpheus: {str(e)}")

    # Step 2: Trigger agent installation
    try:
        install_url = f"{BASE_URL}/servers/{vm_id}/make-managed"
        payload = {
            "server": {
                "sshUsername": req.vm_username,
                "sshPassword": req.vm_password
            },
            "installAgent": True
        }
        
        response = requests.put(install_url, headers=headers, json=payload, verify=False)

        if response.status_code == 200:
            return {"status": "success", "message": "Morpheus agent installation triggered successfully."}
        else:
             raise HTTPException(status_code=response.status_code, detail=f"Failed to install agent: {response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error triggering agent installation: {str(e)}")


@app.post("/api/vms/ping-test")
async def ping_test(request: PingTestRequest):
    results = {}
    for hostname in request.hostnames:
        if not hostname or hostname == "N/A":
            results[hostname] = "failed"
            continue
        
        param = '-n' if platform.system().lower() == 'windows' else '-c'
        command = ['ping', param, '1', hostname]
        
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                results[hostname] = "success"
            else:
                results[hostname] = "failed"
        except subprocess.TimeoutExpired:
            results[hostname] = "failed"
        except Exception:
            results[hostname] = "failed"
            
    return results

def _run_ssh_command_for_files(ip, username, password):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(ip, username=username, password=password, timeout=10)
        command = "ls -laRt / | wc -l"
        stdin, stdout, stderr = client.exec_command(command)
        output = stdout.read().decode(errors="ignore").strip()
        error = stderr.read().decode(errors="ignore").strip()
        
        if error and not output:
             raise Exception(f"SSH command failed: {error}")
        
        return int(output)

    except Exception as e:
        logging.error(f"Failed to run SSH command on {ip}: {e}")
        return -1


@app.post("/api/vms/check-files")
async def check_files(request: CheckFilesRequest):
    results = {}
    
    for host in request.hosts:
        file_count = _run_ssh_command_for_files(
            host.ip_address,
            host.username,
            host.password
        )
        results[host.ip_address] = file_count
    
    return results

# --- Windows chkdsk Logic ---
def _run_ssh_command_windows(ip, username, password, command):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(ip, username=username, password=password, timeout=20)
        stdin, stdout, stderr = client.exec_command(command)
        output = stdout.read().decode(errors="ignore")
        error = stderr.read().decode(errors="ignore")
        if error:
            logging.error(f"Error executing command on {ip}: {error}")
        return output.strip() if output else error.strip()
    finally:
        client.close()

def _get_windows_drives(ip, username, password):
    cmd = 'for %d in (A B C D E F G H I J K L M N O P Q R S T U V W X Y Z) do @if exist %d:\\ echo %d:\\'
    drives_output = _run_ssh_command_windows(ip, username, password, cmd)
    return [line.strip(":\\") for line in drives_output.splitlines() if line.strip()]

import re

def _extract_chkdsk_summary(output: str) -> str:
    """
    Extract only the 'xxx KB in yyy files.' line from chkdsk output.
    """
    for line in output.splitlines():
        match = re.search(r"(\d+)\s+KB in\s+(\d+)\s+files\.", line)
        if match:
            return f"{match.group(1)} KB in {match.group(2)} files."
    return "File count not found"

@app.post("/api/vms/check-files-windows")
async def check_files_windows(request: WindowsCheckFilesRequest):
    CHKDSK_PATH = r"C:\Windows\System32\chkdsk.exe"
    results = {}
    try:
        for host in request.hosts:
            host_results = {}
            drives = _get_windows_drives(host.ip_address, host.username, host.password)
            if not drives:
                host_results["error"] = "Could not detect any drives on the Windows VM."
                continue

            for drive in drives:
                cmd = f'"{CHKDSK_PATH}" {drive}:'
                output = _run_ssh_command_windows(host.ip_address, host.username, host.password, cmd)
                host_results[drive] = _extract_chkdsk_summary(output)
            
            results[host.ip_address] = host_results

    except Exception as e:
        logging.error(f"Error running command on {request.hosts}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    return results


@app.post("/api/vms/shutdown")
async def shutdown_vm(request: ShutdownVmRequest):
    si = None
    try:
        si = get_vcenter_connection(request.host)
        vm = find_vm_by_name(si, request.vmName)
        if not vm:
            raise HTTPException(status_code=404, detail=f"VM '{request.vmName}' not found.")

        if vm.runtime.powerState != vim.VirtualMachinePowerState.poweredOn:
            return {"status": "already_off", "message": f"VM '{request.vmName}' is not powered on."}

        if vm.guest.toolsRunningStatus != "guestToolsRunning":
            raise HTTPException(status_code=400, detail=f"VMware Tools is not running on '{request.vmName}'. Cannot perform graceful shutdown.")

        vm.ShutdownGuest()
        return {"status": "shutdown_initiated", "message": f"Graceful shutdown initiated for '{request.vmName}'."}

    except HTTPException as e:
        raise e
    except Exception as e:
        logging.error(f"Error shutting down VM {request.vmName}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if si:
            connect.Disconnect(si)


# --- IP Reassignment Logic (Fire-and-Forget Approach) ---

# Linux IP Reassignment Functions
def ssh_exec(ssh, cmd, timeout=30, wait=True):
    """Execute SSH command and return output and error with timeout."""
    if wait:
        try:
            stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
            
            # Set timeout for reading output
            stdout.channel.settimeout(timeout)
            stderr.channel.settimeout(timeout)
            
            output = stdout.read().decode().strip()
            error = stderr.read().decode().strip()
            
            return output, error
        except Exception as e:
            logging.error(f"SSH command '{cmd}' failed with error: {e}")
            return "", str(e)
    else:
        # fire-and-forget: don't block waiting for output
        try:
            transport = ssh.get_transport()
            channel = transport.open_session()
            channel.exec_command(cmd)
            return "", ""
        except Exception as e:
            logging.error(f"SSH fire-and-forget command '{cmd}' failed with error: {e}")
            return "", str(e)

def detect_distro(ssh):
    """Detect Linux distribution."""
    out, _ = ssh_exec(ssh, "cat /etc/os-release")
    data = out.lower()
    if "ubuntu" in data:
        return "ubuntu"
    elif "debian" in data:
        return "debian"
    elif "rhel" in data or "centos" in data or "oracle" in data:
        return "rhel"
    elif "suse" in data:
        return "suse"
    return "unknown"

def get_linux_network_details(ssh):
    """Get network interface, gateway and prefix for Linux."""
    # Get default gateway + interface
    out, _ = ssh_exec(ssh, "ip route | grep default")
    if not out:
        return None, None, None
    parts = out.split()
    gateway = parts[2]
    iface = parts[4]

    # Get prefix length
    out, _ = ssh_exec(ssh, f"ip -o -f inet addr show dev {iface}")
    match = re.search(r'inet (\d+\.\d+\.\d+\.\d+)/(\d+)', out)
    if not match:
        return iface, gateway, None
    prefix = match.group(2)
    return iface, gateway, prefix

def update_linux_ip_address_and_disconnect(ssh, distro, iface, new_ip, prefix, gateway):
    """Apply new IP configuration and immediately disconnect SSH session (fire-and-forget)."""
    if distro in ["rhel", "centos", "oracle", "suse"]:
        cmds = [
            f"nmcli con mod {iface} ipv4.addresses {new_ip}/{prefix}",
            f"nmcli con mod {iface} ipv4.method manual",
            f"nmcli con mod {iface} ipv4.gateway {gateway}",
            f"nmcli con up {iface}"
        ]
        for c in cmds:
            logging.info(f"Sending: {c}")
            ssh_exec(ssh, c, wait=False)

    elif distro == "ubuntu":
        out, _ = ssh_exec(ssh, "ls /etc/netplan/*.yaml /etc/netplan/*.yml 2>/dev/null")
        if not out:
            raise Exception("No netplan config found.")
        yaml_path = out.splitlines()[0]

        content, _ = ssh_exec(ssh, f"cat {yaml_path}")
        try:
            netplan_cfg = yaml.safe_load(content)
        except yaml.YAMLError as e:
            raise Exception(f"Failed to parse netplan config: {e}")

        # Update the network configuration
        ethernets = netplan_cfg.setdefault("network", {}).setdefault("ethernets", {})
        for iface_name, iface_conf in ethernets.items():
            if iface_name == iface:
                iface_conf["dhcp4"] = False
                iface_conf["addresses"] = [f"{new_ip}/{prefix}"]
                iface_conf["gateway4"] = gateway
                break

        # Write the updated config to a temporary file and upload
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.yaml') as tmp_file:
            yaml.safe_dump(netplan_cfg, tmp_file)
            local_temp_path = tmp_file.name

        try:
            sftp = ssh.open_sftp()
            remote_tmp_path = "/tmp/netplan_new.yaml"
            sftp.put(local_temp_path, remote_tmp_path)
            sftp.close()

            cmd = f"mv {remote_tmp_path} {yaml_path} && netplan apply"
            logging.info(f"Sending: {cmd}")
            ssh_exec(ssh, cmd, wait=False)
        finally:
            os.unlink(local_temp_path)

    elif distro == "debian":
        out, _ = ssh_exec(ssh, "cat /etc/network/interfaces")
        lines = out.splitlines()
        new_lines = []
        
        for line in lines:
            if line.strip().startswith("address"):
                new_lines.append(f"    address {new_ip}")
            elif line.strip().startswith("gateway"):
                new_lines.append(f"    gateway {gateway}")
            else:
                new_lines.append(line)

        # Write the updated interfaces file
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.interfaces') as tmp_file:
            tmp_file.write("\n".join(new_lines))
            local_temp_path = tmp_file.name

        try:
            sftp = ssh.open_sftp()
            sftp.put(local_temp_path, "/tmp/interfaces_new")
            sftp.close()

            cmd = "mv /tmp/interfaces_new /etc/network/interfaces && ifdown -a && ifup -a"
            logging.info(f"Sending: {cmd}")
            ssh_exec(ssh, cmd, wait=False)
        finally:
            os.unlink(local_temp_path)

    else:
        raise Exception(f"Unsupported Linux distribution: {distro}")
    
    # Give time for command to fire before closing session
    time.sleep(2)
    logging.info("Closing SSH session (host will change IP).")
    ssh.close()

# Windows IP Reassignment Functions
def get_interface_details(ssh, source_ip):
    """
    Run 'netsh interface ip show config' on remote Windows host via SSH
    and parse the details for the given source IP.
    """
    stdin, stdout, stderr = ssh.exec_command(r'C:\Windows\System32\netsh.exe interface ip show config')
    output = stdout.read().decode()
    error = stderr.read().decode()

    if error:
        logging.error(f"netsh failed: {error}")
        return None, None, None

    interfaces = output.split("Configuration for interface")

    for block in interfaces:
        if source_ip in block:
            # Extract interface name
            match_name = re.search(r'"(.+?)"', block)
            interface_name = match_name.group(1) if match_name else None

            # Extract subnet prefix (/CIDR -> Subnet Mask)
            match_subnet = re.search(r"Subnet Prefix:\s+(\d+\.\d+\.\d+\.\d+)/(\d+)", block)
            subnet_mask = None
            if match_subnet:
                _, cidr = match_subnet.groups()
                cidr = int(cidr)
                mask = (0xffffffff >> (32 - cidr)) << (32 - cidr)
                subnet_mask = ".".join([str((mask >> (i * 8)) & 0xFF) for i in range(3, -1, -1)])

            # Extract gateway
            match_gw = re.search(r"Default Gateway:\s+(\d+\.\d+\.\d+\.\d+)", block)
            gateway = match_gw.group(1) if match_gw else None

            return interface_name, subnet_mask, gateway

    return None, None, None


def change_windows_ip_and_disconnect(ssh, interface, target_ip, subnet_mask, gateway):
    """
    Run netsh to assign a new static IP on remote Windows host via SSH.
    Close session immediately after sending command (fire-and-forget).
    """
    command = (
        fr'C:\Windows\System32\netsh.exe interface ip set address '
        fr'name="{interface}" static {target_ip} {subnet_mask} {gateway}'
    )
    logging.info(f"Sending command (will disconnect after IP change): {command}")

    transport = ssh.get_transport()
    channel = transport.open_session()
    channel.exec_command(command)

    # Give the command a moment to start
    time.sleep(2)

    logging.info("Closing SSH session (IP change may disconnect this host).")
    ssh.close()


def run_ip_reassignment_task(request: IpReassignmentRequest):
    """Background task to handle IP reassignment with detailed logging."""
    source_ip = request.source_ip
    target_ip = request.target_ip
    
    # Initialize logs
    ip_reassignment_logs[source_ip] = []
    
    ssh = None
    try:
        # Step 1: Connecting
        update_ip_reassignment_logs(source_ip, f"[INFO] Connecting to {source_ip} via SSH...")
        
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(
            source_ip, 
            port=22, 
            username=request.username, 
            password=request.password, 
            timeout=30,
            banner_timeout=30,
            auth_timeout=30,
            look_for_keys=False,
            allow_agent=False
        )
        
        update_ip_reassignment_logs(source_ip, "[INFO] SSH connection established.")
        
        if request.os_type.lower() == 'windows':
            # Windows IP reassignment with detailed logging
            interface, subnet_mask, gateway = get_interface_details(ssh, source_ip)
            
            if not interface or not subnet_mask or not gateway:
                update_ip_reassignment_logs(source_ip, f"[ERROR] Could not detect network configuration for source IP {source_ip}")
                return
            
            update_ip_reassignment_logs(source_ip, f"[INFO] Interface: {interface}")
            update_ip_reassignment_logs(source_ip, f"[INFO] Subnet   : {subnet_mask}")
            update_ip_reassignment_logs(source_ip, f"[INFO] Gateway  : {gateway}")
            update_ip_reassignment_logs(source_ip, f"[INFO] Target IP: {target_ip}")
            update_ip_reassignment_logs(source_ip, "Proceed with IP change? (y/n): y")
            
            command = (
                fr'C:\Windows\System32\netsh.exe interface ip set address '
                fr'name="{interface}" static {target_ip} {subnet_mask} {gateway}'
            )
            update_ip_reassignment_logs(source_ip, f"[INFO] Sending command (will disconnect after IP change): {command}")
            
            # Fire-and-forget IP change
            transport = ssh.get_transport()
            channel = transport.open_session()
            channel.exec_command(command)
            time.sleep(2)
            
            update_ip_reassignment_logs(source_ip, "[INFO] Closing SSH session (IP change may disconnect this host).")
            ssh.close()
            ssh = None
            
        elif request.os_type.lower() == 'linux':
            # Linux IP reassignment with detailed logging
            distro = detect_distro(ssh)
            interface, gateway, prefix = get_linux_network_details(ssh)
            
            if not interface or not gateway or not prefix:
                update_ip_reassignment_logs(source_ip, f"[ERROR] Could not detect network configuration for source IP {source_ip}")
                return
            
            update_ip_reassignment_logs(source_ip, "[INFO] Detected network details:")
            update_ip_reassignment_logs(source_ip, f"  Distro   : {distro}")
            update_ip_reassignment_logs(source_ip, f"  Interface: {interface}")
            update_ip_reassignment_logs(source_ip, f"  Gateway  : {gateway}")
            update_ip_reassignment_logs(source_ip, f"  Subnet   : /{prefix}")
            update_ip_reassignment_logs(source_ip, f"Change IP from {source_ip} → {target_ip}? (yes/no): yes")
            
            # Fire-and-forget commands based on distro
            if distro in ["rhel", "centos", "oracle", "suse"]:
                cmds = [
                    f"nmcli con mod {interface} ipv4.addresses {target_ip}/{prefix}",
                    f"nmcli con mod {interface} ipv4.method manual",
                    f"nmcli con mod {interface} ipv4.gateway {gateway}",
                    f"nmcli con up {interface}"
                ]
                for c in cmds:
                    update_ip_reassignment_logs(source_ip, f"[INFO] Sending: {c}")
                    ssh_exec(ssh, c, wait=False)
            
            elif distro == "ubuntu":
                out, _ = ssh_exec(ssh, "ls /etc/netplan/*.yaml /etc/netplan/*.yml 2>/dev/null")
                if not out:
                    update_ip_reassignment_logs(source_ip, "[ERROR] No netplan config found.")
                    return
                yaml_path = out.splitlines()[0]
                
                content, _ = ssh_exec(ssh, f"cat {yaml_path}")
                try:
                    netplan_cfg = yaml.safe_load(content)
                except yaml.YAMLError as e:
                    update_ip_reassignment_logs(source_ip, f"[ERROR] Failed to parse netplan config: {e}")
                    return
                
                # Update the network configuration
                ethernets = netplan_cfg.setdefault("network", {}).setdefault("ethernets", {})
                for iface_name, iface_conf in ethernets.items():
                    if iface_name == interface:
                        iface_conf["dhcp4"] = False
                        iface_conf["addresses"] = [f"{target_ip}/{prefix}"]
                        iface_conf["gateway4"] = gateway
                        break
                
                # Write the updated config
                with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.yaml') as tmp_file:
                    yaml.safe_dump(netplan_cfg, tmp_file)
                    local_temp_path = tmp_file.name
                
                try:
                    sftp = ssh.open_sftp()
                    remote_tmp_path = "/tmp/netplan_new.yaml"
                    sftp.put(local_temp_path, remote_tmp_path)
                    sftp.close()
                    
                    cmd = f"mv {remote_tmp_path} {yaml_path} && netplan apply"
                    update_ip_reassignment_logs(source_ip, f"[INFO] Sending: {cmd}")
                    ssh_exec(ssh, cmd, wait=False)
                finally:
                    os.unlink(local_temp_path)
            
            elif distro == "debian":
                out, _ = ssh_exec(ssh, "cat /etc/network/interfaces")
                lines = out.splitlines()
                new_lines = []
                
                for line in lines:
                    if line.strip().startswith("address"):
                        new_lines.append(f"    address {target_ip}")
                    elif line.strip().startswith("gateway"):
                        new_lines.append(f"    gateway {gateway}")
                    else:
                        new_lines.append(line)
                
                # Write the updated interfaces file
                with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.interfaces') as tmp_file:
                    tmp_file.write("\n".join(new_lines))
                    local_temp_path = tmp_file.name
                
                try:
                    sftp = ssh.open_sftp()
                    sftp.put(local_temp_path, "/tmp/interfaces_new")
                    sftp.close()
                    
                    cmd = "mv /tmp/interfaces_new /etc/network/interfaces && ifdown -a && ifup -a"
                    update_ip_reassignment_logs(source_ip, f"[INFO] Sending: {cmd}")
                    ssh_exec(ssh, cmd, wait=False)
                finally:
                    os.unlink(local_temp_path)
            
            # Give time for command to fire before closing session
            time.sleep(2)
            update_ip_reassignment_logs(source_ip, "[INFO] Closing SSH session (host will change IP).")
            ssh.close()
            ssh = None
            update_ip_reassignment_logs(source_ip, f"[SUCCESS] Sent IP change command for {target_ip}")
        
        else:
            update_ip_reassignment_logs(source_ip, f"[ERROR] Unsupported OS type: {request.os_type}")
            
    except paramiko.AuthenticationException:
        update_ip_reassignment_logs(source_ip, "[ERROR] SSH authentication failed. Check username and password.")
    except paramiko.SSHException as e:
        update_ip_reassignment_logs(source_ip, f"[ERROR] SSH connection error: {str(e)}")
    except Exception as e:
        update_ip_reassignment_logs(source_ip, f"[ERROR] An unexpected error occurred: {str(e)}")
    finally:
        if ssh:
            try:
                ssh.close()
            except Exception as e:
                update_ip_reassignment_logs(source_ip, f"[WARNING] Error closing SSH connection: {e}")
@app.post("/api/vms/reassign-ip")
async def reassign_vm_ip(request: IpReassignmentRequest, background_tasks: BackgroundTasks):
    """Reassign IP address for a Windows or Linux VM via SSH using fire-and-forget approach with real-time logs."""
    logging.debug(f"IP reassignment request for {request.source_ip} -> {request.target_ip} (OS: {request.os_type})")
    
    # Initialize empty logs for immediate response
    ip_reassignment_logs[request.source_ip] = []
    
    # Start background task
    background_tasks.add_task(run_ip_reassignment_task, request)
    
    return {
        "status": "started",
        "message": f"IP reassignment process initiated for {request.source_ip} -> {request.target_ip}",
        "source_ip": request.source_ip,
        "target_ip": request.target_ip,
        "os_type": request.os_type,
        "fire_and_forget": True
    }

@app.get("/api/vms/reassign-ip/logs/{source_ip}")
async def get_ip_reassignment_logs(source_ip: str):
    """Get real-time logs for IP reassignment process."""
    logs = ip_reassignment_logs.get(source_ip, [])
    return {
        "source_ip": source_ip,
        "logs": logs,
        "log_count": len(logs)
    }

