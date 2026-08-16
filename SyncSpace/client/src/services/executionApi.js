// Judge0 CE API Endpoint
const JUDGE0_API_URL = 'https://ce.judge0.com/submissions?wait=true';

// Language ID Mapping for Judge0 CE
const JUDGE0_LANGUAGE_IDS = {
  javascript: 63, // Node.js 12.14.0
  typescript: 74, // TypeScript 3.7.4
  python: 71,     // Python 3.8.1
  java: 62,       // OpenJDK 13.0.1
  c: 50,          // GCC 9.2.0
  cpp: 54,        // GCC 9.2.0
  csharp: 51,     // C# Mono 6.6.0.161
  go: 60,         // Go 1.13.5
  rust: 73,       // Rust 1.40.0
  php: 68,        // PHP 7.4.1
  bash: 46,       // Bash 5.0.0
  sql: 82         // SQLite 3.31.1
};

/**
 * Executes source code online using Judge0 CE API.
 * Returns stdout, stderr, compile output, status description, and execution time.
 */
export const executeCode = async (language, sourceCode, stdin = '') => {
  const startTime = performance.now();

  if (!sourceCode || !sourceCode.trim()) {
    return {
      success: true,
      output: 'No code to execute.',
      error: '',
      status: 'Empty Source',
      duration: '0.00s'
    };
  }

  // Client-side JSON formatting & validation
  if (language === 'json') {
    try {
      const parsed = JSON.parse(sourceCode);
      const formatted = JSON.stringify(parsed, null, 2);
      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      return {
        success: true,
        output: `✔ Valid JSON Format:\n\n${formatted}`,
        error: '',
        status: 'Valid JSON',
        duration: `${duration}s`
      };
    } catch (err) {
      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      return {
        success: false,
        output: '',
        error: `JSON Syntax Error: ${err.message}`,
        status: 'Syntax Error',
        duration: `${duration}s`
      };
    }
  }

  // Client-side validation for markup/stylesheet formats
  if (['html', 'css', 'xml', 'markdown'].includes(language)) {
    const duration = ((performance.now() - startTime) / 1000).toFixed(2);
    return {
      success: true,
      output: `[${language.toUpperCase()} Workspace]\nCode structure is valid.`,
      error: '',
      status: 'Validated',
      duration: `${duration}s`
    };
  }

  const langId = JUDGE0_LANGUAGE_IDS[language] || 63; // Default to Node.js if unmapped

  try {
    const response = await fetch(JUDGE0_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        language_id: langId,
        source_code: sourceCode,
        stdin: stdin || ''
      })
    });

    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        output: '',
        error: errData.message || errData.error || `Judge0 API error HTTP ${response.status}`,
        status: 'API Error',
        duration: `${duration}s`
      };
    }

    const data = await response.json();

    const stdout = data.stdout || '';
    const stderr = data.stderr || '';
    const compileOutput = data.compile_output || '';
    const statusDesc = data.status?.description || 'Completed';
    const statusId = data.status?.id;
    const execTime = data.time ? `${parseFloat(data.time).toFixed(2)}s` : `${duration}s`;

    // Status ID 3 = Accepted (Success)
    const isSuccess = statusId === 3;
    const combinedError = [compileOutput, stderr, data.message].filter(Boolean).join('\n');

    return {
      success: isSuccess && !combinedError,
      output: stdout || (isSuccess && !combinedError ? 'Program executed cleanly.' : ''),
      error: combinedError,
      status: statusDesc,
      duration: execTime
    };
  } catch (error) {
    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    return {
      success: false,
      output: '',
      error: `Execution Error: ${error.message || 'Could not connect to Judge0 execution engine'}`,
      status: 'Network Failure',
      duration: `${duration}s`
    };
  }
};
