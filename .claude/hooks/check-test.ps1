[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8

try {
    $input_json = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($input_json)) { exit 0 }

    $data = $input_json | ConvertFrom-Json
    $file = $data.tool_input.file_path

    if ([string]::IsNullOrWhiteSpace($file)) { exit 0 }

    # src/ 경로 필터
    if ($file -notmatch '[\\/]src[\\/]') { exit 0 }

    # .ts / .tsx 확장자 필터
    if ($file -notmatch '\.(tsx?)$') { exit 0 }

    # 테스트 파일 자체는 제외
    if ($file -match '\.test\.(tsx?)$') { exit 0 }

    # 확장자 제거 후 테스트 파일 경로 계산
    $base = $file -replace '\.(tsx?)$', ''
    $testTs  = "$base.test.ts"
    $testTsx = "$base.test.tsx"

    if (-not (Test-Path $testTs) -and -not (Test-Path $testTsx)) {
        [Console]::Error.WriteLine("WARNING: 테스트 파일 없음 — $file")
        exit 1
    }
} catch {
    # 절대 차단 금지 — 에러 무시 후 정상 종료
}

exit 0
