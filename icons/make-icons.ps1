# GlassTab icon generator — rounded gradient tile + 4-point sparkle.
# Pure GDI+, no dependencies. Run: powershell -File make-icons.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$master = 512
$radius = 112

$bmp = New-Object System.Drawing.Bitmap($master, $master)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# Rounded-square path
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$d = 2 * $radius
$path.AddArc(0, 0, $d, $d, 180, 90)
$path.AddArc($master - $d, 0, $d, $d, 270, 90)
$path.AddArc($master - $d, $master - $d, $d, $d, 0, 90)
$path.AddArc(0, $master - $d, $d, $d, 90, 90)
$path.CloseFigure()

# Diagonal gradient fill: purple -> cyan (accent tokens)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point(0, $master)),
  (New-Object System.Drawing.Point($master, 0)),
  [System.Drawing.Color]::FromArgb(255, 124, 92, 255),
  [System.Drawing.Color]::FromArgb(255, 34, 211, 238))
$g.FillPath($brush, $path)

# Soft inner highlight (top edge)
$hl = New-Object System.Drawing.Drawing2D.GraphicsPath
$hl.AddArc(20, 14, $master - 40, 120, 180, 180)
$hlBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Point(0, 10)), (New-Object System.Drawing.Point(0, 140)),
  [System.Drawing.Color]::FromArgb(70, 255, 255, 255),
  [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
$g.FillPath($hlBrush, $hl)

# 4-point sparkle (outer points at N/E/S/W, inner between)
$cx = 256.0; $cy = 262.0
$outer = 132.0; $inner = 36.0
$pts = New-Object 'System.Collections.Generic.List[System.Drawing.PointF]'
foreach ($t in @(
  @(0, -1, $outer), @(0.354, -0.354, $inner), @(1, 0, $outer), @(0.354, 0.354, $inner),
  @(0, 1, $outer), @(-0.354, 0.354, $inner), @(-1, 0, $outer), @(-0.354, -0.354, $inner))) {
  $pts.Add((New-Object System.Drawing.PointF(($cx + $t[0] * $t[2]), ($cy + $t[1] * $t[2]))))
}
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(238, 255, 255, 255))
$g.FillPolygon($white, $pts.ToArray())

# small companion dot
$dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(190, 255, 255, 255))
$g.FillEllipse($dotBrush, 356, 128, 34, 34)

$g.Dispose()

foreach ($size in 16, 32, 48, 128) {
  $small = New-Object System.Drawing.Bitmap($size, $size)
  $g2 = [System.Drawing.Graphics]::FromImage($small)
  $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g2.DrawImage($bmp, 0, 0, $size, $size)
  $g2.Dispose()
  $out = Join-Path $PSScriptRoot ("icon{0}.png" -f $size)
  $small.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $small.Dispose()
  Write-Host "wrote $out"
}

$bmp.Dispose()
Write-Host "done"
