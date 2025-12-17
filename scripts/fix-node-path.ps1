# Helper: Fix Node.js and npm not found on PATH (Windows PowerShell)
# Usage: run in PowerShell, then open a new terminal session.

# Add Node.js folder to User PATH
$nodePath = 'C:\Program Files\nodejs'
$userPath = [Environment]::GetEnvironmentVariable('Path','User')
if ($userPath -notlike "*$nodePath*") {
  [Environment]::SetEnvironmentVariable('Path', $userPath + ";" + $nodePath, 'User')
}

# Add global npm bin path to User PATH
$npmRoaming = "$env:APPDATA\npm"  # e.g., C:\Users\<you>\AppData\Roaming\npm
$userPath = [Environment]::GetEnvironmentVariable('Path','User')
if ($userPath -notlike "*$npmRoaming*") {
  [Environment]::SetEnvironmentVariable('Path', $userPath + ";" + $npmRoaming, 'User')
}

# Reload this session's PATH
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
            [System.Environment]::GetEnvironmentVariable('Path', 'User')

# Test
node -v
npm -v
