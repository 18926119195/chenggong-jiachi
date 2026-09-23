[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

# Get files
$folder = "C:\Users\Administrator\Desktop\2026-09-21-master"
$files = Get-ChildItem -Path $folder -Filter "final-noun-index.json" -Recurse -ErrorAction SilentlyContinue

Write-Host "Found $($files.Count) files:"
$files | ForEach-Object { Write-Host "  $($_.FullName)" }

# Parse JSON using Get-Content with encoding
$content1 = Get-Content -Path $files[0].FullName -Raw -Encoding UTF8
$content2 = Get-Content -Path $files[1].FullName -Raw -Encoding UTF8

# Try to convert to JSON (this may fail due to large size)
try {
    $data1 = $content1 | ConvertFrom-Json
    $data2 = $content2 | ConvertFrom-Json
} catch {
    Write-Host "JSON parse error: $_"
    exit
}

Write-Host ""
Write-Host "=== META COMPARISON ==="
Write-Host "File 1 ($($files[0].Directory.Name)): nouns=$($data1.meta.totalNouns) s0=$($data1.meta.s0Count) s1=$($data1.meta.s1Count) offsets=$($data1.meta.totalOffsets)"
Write-Host "File 2 ($($files[1].Directory.Name)): nouns=$($data2.meta.totalNouns) s0=$($data2.meta.s0Count) s1=$($data2.meta.s1Count) offsets=$($data2.meta.totalOffsets)"

Write-Host ""
Write-Host "=== INTERSECTION ==="
$nouns1 = $data1.nouns
$nouns2 = $data2.nouns

$ids1 = @($nouns1 | ForEach-Object { $_.id })
$ids2 = @($nouns2 | ForEach-Object { $_.id })

$common = @($ids1 | Where-Object { $ids2 -contains $_ })
$only1 = @($ids1 | Where-Object { $ids2 -notcontains $_ })
$only2 = @($ids2 | Where-Object { $ids1 -notcontains $_ })

Write-Host "Common: $($common.Count)"
Write-Host "Only in File1: $($only1.Count)"
Write-Host "Only in File2: $($only2.Count)"

Write-Host ""
Write-Host "=== Sample nouns ONLY in File1 ==="
$only1Sample = $only1 | Select-Object -First 15
foreach ($id in $only1Sample) {
    $noun = $nouns1 | Where-Object { $_.id -eq $id } | Select-Object -First 1
    if ($noun) {
        Write-Host "  $($id) - Surface: $($noun.surface), Offsets: $($noun.offsets.Count), Source: $($noun.source)"
    }
}

Write-Host ""
Write-Host "=== Sample nouns ONLY in File2 ==="
$only2Sample = $only2 | Select-Object -First 15
foreach ($id in $only2Sample) {
    $noun = $nouns2 | Where-Object { $_.id -eq $id } | Select-Object -First 1
    if ($noun) {
        Write-Host "  $($id) - Surface: $($noun.surface), Offsets: $($noun.offsets.Count), Source: $($noun.source)"
    }
}

Write-Host ""
Write-Host "=== Position comparison for common nouns (sample 5) ==="
$commonSample = $common | Select-Object -First 5
foreach ($id in $commonSample) {
    $n1 = $nouns1 | Where-Object { $_.id -eq $id } | Select-Object -First 1
    $n2 = $nouns2 | Where-Object { $_.id -eq $id } | Select-Object -First 1
    if ($n1 -and $n2) {
        $diff = $n1.offsets.Count - $n2.offsets.Count
        Write-Host "  $($id): File1=$($n1.offsets.Count) File2=$($n2.offsets.Count) Diff=$($diff)"
    }
}
