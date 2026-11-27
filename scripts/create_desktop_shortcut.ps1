$wsh = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "Nayashi Kirana POS (Direct Print).lnk"

# Find Chrome path
$chromePath = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
    $chromePath = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
}
if (-not (Test-Path $chromePath)) {
    $chromePath = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
}
if (-not (Test-Path $chromePath)) {
    $chromePath = "chrome.exe"
}

$userDataDir = Join-Path $env:LOCALAPPDATA "NayashiPOSProfile"

$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $chromePath
$shortcut.Arguments = "--app=http://localhost:5173/pos --kiosk-printing --user-data-dir=`"$userDataDir`""
$shortcut.WorkingDirectory = [Environment]::GetFolderPath('Desktop')
$shortcut.IconLocation = "$chromePath,0"
$shortcut.Description = "Nayashi Kirana POS - Direct Silent Print (80mm)"
$shortcut.Save()

Write-Output "SUCCESS: Created shortcut at $shortcutPath"
