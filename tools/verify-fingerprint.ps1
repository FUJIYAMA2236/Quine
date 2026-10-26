# QUINE のWikiファイルから「アプリの指紋」（記事データを除くプログラム部分の SHA-256）を計算します。
# アプリの「このツールについて」に出る値を、アプリの外から確かめるためのものです。
# 使い方（PowerShell）:
#   powershell -ExecutionPolicy Bypass -File .\tools\verify-fingerprint.ps1 -Path .\quine.html
# 表示された値を、GitHub の FINGERPRINT.txt の「アプリの指紋」と比べてください。
param([Parameter(Mandatory = $true)][string]$Path)

$text = [IO.File]::ReadAllText((Resolve-Path $Path), [Text.Encoding]::UTF8)
$text = $text -replace "`r`n", "`n" -replace "`r", "`n"   # ブラウザと同じく改行をそろえる
$style = [regex]::Match($text, '<style>([\s\S]*?)</style>')
$script = [regex]::Match($text, '<script id="quine-app">([\s\S]*?)</script>')
if (-not $style.Success -or -not $script.Success) {
  Write-Host "QUINE のファイルではないか、プログラム部分が見つかりません。" -ForegroundColor Red
  exit 1
}
$bytes = [Text.Encoding]::UTF8.GetBytes($style.Groups[1].Value + "`n" + $script.Groups[1].Value)
$sha = [Security.Cryptography.SHA256]::Create()
$hex = ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join ''
Write-Host "アプリの指紋: $hex"
