$path = 'C:\Users\ADMIN\Desktop\AirTech AI\src\pages\Settings.tsx'
$lines = Get-Content $path
$output = @()
$skip = $false
$foundFirst = $false

foreach ($line in $lines) {
    if ($line -match '^function ShortcutsEditor') {
        if ($foundFirst) {
            $skip = $true
        } else {
            $foundFirst = $true
        }
    }
    if ($skip) {
        if ($line -match '^\}') {
            $skip = $false
        }
        continue
    }
    $output += $line
}

$output | Set-Content $path
Write-Host "Done"