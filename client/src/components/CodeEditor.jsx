import React, { useState, useEffect, useRef } from 'react';
import {
  Code2, Copy, Check, Loader2, Lock, Play, Terminal,
  Trash2, ChevronDown, ChevronUp, Sparkles, Maximize2, Minimize2, User
}  from 'lucide-react';
import toast from 'react-hot-toast';
import { executeCode } from '../services/executionApi';

const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', monacoLang: 'javascript' },
  { id: 'typescript', label: 'TypeScript', monacoLang: 'typescript' },
  { id: 'python', label: 'Python', monacoLang: 'python' },
  { id: 'java', label: 'Java', monacoLang: 'java' },
  { id: 'c', label: 'C', monacoLang: 'c' },
  { id: 'cpp', label: 'C++', monacoLang: 'cpp' },
  { id: 'csharp', label: 'C#', monacoLang: 'csharp' },
  { id: 'go', label: 'Go', monacoLang: 'go' },
  { id: 'rust', label: 'Rust', monacoLang: 'rust' },
  { id: 'php', label: 'PHP', monacoLang: 'php' },
  { id: 'html', label: 'HTML', monacoLang: 'html' },
  { id: 'css', label: 'CSS', monacoLang: 'css' },
  { id: 'json', label: 'JSON', monacoLang: 'json' },
  { id: 'sql', label: 'SQL', monacoLang: 'sql' },
  { id: 'xml', label: 'XML', monacoLang: 'xml' },
  { id: 'markdown', label: 'Markdown', monacoLang: 'markdown' },
  { id: 'bash', label: 'Bash', monacoLang: 'shell' }
];

const DEFAULT_TEMPLATES = {
  javascript: `// JavaScript Workspace\nconsole.log("Hello World");\n`,
  typescript: `// TypeScript Workspace\nconst message: string = "Hello World";\nconsole.log(message);\n`,
  python: `# Python Workspace\nprint("Hello World")\n`,
  java: `// Java Workspace\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello World");\n    }\n}\n`,
  c: `// C Workspace\n#include <stdio.h>\n\nint main() {\n    printf("Hello World\\n");\n    return 0;\n}\n`,
  cpp: `// C++ Workspace\n#include <iostream>\n\nint main() {\n    std::cout << "Hello World" << std::endl;\n    return 0;\n}\n`,
  csharp: `// C# Workspace\nusing System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello World");\n    }\n}\n`,
  go: `// Go Workspace\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello World")\n}\n`,
  rust: `// Rust Workspace\nfn main() {\n    println!("Hello World");\n}\n`,
  php: `<?php\n// PHP Workspace\necho "Hello World\\n";\n?>\n`,
  html: `<!DOCTYPE html>\n<html>\n<head>\n  <title>SyncSpace Page</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>\n`,
  css: `/* CSS Stylesheet */\nbody {\n  background-color: #121212;\n  color: #ffffff;\n  font-family: sans-serif;\n}\n`,
  json: `{\n  "message": "Hello World",\n  "status": "active"\n}\n`,
  sql: `-- SQL Queries\nSELECT 'Hello World' AS greeting;\n`,
  xml: `<?xml version="1.0" encoding="UTF-8"?>\n<greeting>Hello World</greeting>\n`,
  markdown: `# Hello World\n\nWelcome to **SyncSpace** collaborative editor!\n`,
  bash: `#!/bin/bash\necho "Hello World"\n`
};

const getMonacoLang = (langId) => {
  const found = LANGUAGES.find(l => l.id === langId);
  return found ? found.monacoLang : langId;
};

export default function CodeEditor({
  roomId,
  socket,
  currentUser,
  onCodeChange,
  initialCode,
  initialLanguage,
  replayCode = null,
  replayLanguage = null,
  isReplayMode = false,
  panelMode = 'split',
  onToggleMaximize
}) {
  const startLang = initialLanguage || 'javascript';
  const startCode = initialCode !== undefined && initialCode !== null ? initialCode : (DEFAULT_TEMPLATES[startLang] || '');

  const [language, setLanguage] = useState(startLang);
  const [code, setCode] = useState(startCode);
  const [copied, setCopied] = useState(false);
  const [editorLoaded, setEditorLoaded] = useState(false);

  // Execution & Output Console state
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState('');
  const [consoleError, setConsoleError] = useState('');
  const [consoleStatus, setConsoleStatus] = useState('');
  const [consoleDuration, setConsoleDuration] = useState('');
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [executedBy, setExecutedBy] = useState('');

  // Per-language code storage map
  const codeByLanguageRef = useRef({
    [startLang]: startCode
  });

  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const isRemoteEditRef = useRef(false);
  const decorationsRef = useRef({});
  const styleElementRef = useRef(null);
  const consoleBottomRef = useRef(null);

  const activeCode = isReplayMode && replayCode !== null ? replayCode : code;
  const activeLanguage = isReplayMode && replayLanguage !== null ? replayLanguage : language;

  // Toggle readOnly mode when isReplayMode changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: isReplayMode });
    }
  }, [isReplayMode]);

  // Update Monaco value when replay code or active code changes
  useEffect(() => {
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model && model.getValue() !== activeCode) {
        isRemoteEditRef.current = true;
        editorRef.current.setValue(activeCode);
        isRemoteEditRef.current = false;
      }
    }
  }, [activeCode]);

  // Sync initial code from recovery
  useEffect(() => {
    if (!isReplayMode && initialCode !== undefined && initialCode !== null) {
      const currentLang = initialLanguage || language;
      codeByLanguageRef.current[currentLang] = initialCode;
      if (initialCode !== code) {
        setCode(initialCode);
      }
    }
  }, [initialCode, isReplayMode]);

  useEffect(() => {
    if (!isReplayMode && initialLanguage && initialLanguage !== language) {
      setLanguage(initialLanguage);
    }
  }, [initialLanguage, isReplayMode]);

  // Inject dynamic CSS style tag for remote cursor carets & text selection highlights
  useEffect(() => {
    let styleEl = document.getElementById('monaco-remote-cursor-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'monaco-remote-cursor-styles';
      document.head.appendChild(styleEl);
    }
    styleElementRef.current = styleEl;
  }, []);

  const updateUserStyles = (userId, color, name) => {
    if (!styleElementRef.current) return;
    const safeId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '');
    const cssRuleId = `user-style-${safeId}`;

    if (styleElementRef.current.innerHTML.includes(cssRuleId)) return;

    const newCss = `
      /* ${cssRuleId} */
      .remote-cursor-${safeId} {
        background-color: ${color} !important;
        width: 2px !important;
        position: absolute;
      }
      .remote-cursor-${safeId}::after {
        content: '${name}';
        position: absolute;
        top: -18px;
        left: 0;
        background: ${color};
        color: #ffffff;
        font-size: 10px;
        font-weight: 600;
        padding: 1px 4px;
        border-radius: 3px;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 2px 4px rgba(0,0,0,0.4);
        z-index: 100;
      }
      .remote-selection-${safeId} {
        background-color: ${color}33 !important;
        border-radius: 2px;
      }
    `;

    styleElementRef.current.innerHTML += newCss;
  };

  // Load Monaco from CDN dynamically
  useEffect(() => {
    let isCancelled = false;

    const initMonaco = () => {
      if (window.monaco) {
        setupMonacoInstance(window.monaco);
        return;
      }

      if (!window.require) {
        const loaderScript = document.createElement('script');
        loaderScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js';
        loaderScript.onload = () => {
          if (isCancelled) return;
          window.require.config({
            paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }
          });
          window.require(['vs/editor/editor.main'], () => {
            if (isCancelled) return;
            setupMonacoInstance(window.monaco);
          });
        };
        document.body.appendChild(loaderScript);
      } else {
        window.require.config({
          paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' }
        });
        window.require(['vs/editor/editor.main'], () => {
          if (isCancelled) return;
          setupMonacoInstance(window.monaco);
        });
      }
    };

    const setupMonacoInstance = (monaco) => {
      if (!containerRef.current || editorRef.current) return;
      monacoRef.current = monaco;

      const editor = monaco.editor.create(containerRef.current, {
        value: activeCode,
        language: getMonacoLang(activeLanguage),
        theme: 'vs-dark',
        readOnly: isReplayMode,
        fontSize: 13,
        fontFamily: 'Fira Code, Consolas, monospace',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        padding: { top: 12, bottom: 12 }
      });

      editorRef.current = editor;
      setEditorLoaded(true);

      // Track typing changes
      editor.onDidChangeModelContent(() => {
        if (isRemoteEditRef.current || isReplayMode) return;
        const val = editor.getValue();
        setCode(val);
        codeByLanguageRef.current[language] = val;

        if (onCodeChange) onCodeChange(val);
        socket?.emit('code-change', { roomId, code: val, language });
      });

      // Track cursor position & selection changes for remote cursors
      editor.onDidChangeCursorPosition((e) => {
        if (!socket || isRemoteEditRef.current || isReplayMode) return;
        const selection = editor.getSelection();
        socket.emit('cursor-change', {
          roomId,
          userName: currentUser?.name || 'User',
          userColor: currentUser?.color || '#6366F1',
          position: e.position,
          selection: selection ? {
            startLineNumber: selection.startLineNumber,
            startColumn: selection.startColumn,
            endLineNumber: selection.endLineNumber,
            endColumn: selection.endColumn
          } : null
        });
      });

      editor.onDidChangeCursorSelection((e) => {
        if (!socket || isRemoteEditRef.current || isReplayMode) return;
        socket.emit('cursor-change', {
          roomId,
          userName: currentUser?.name || 'User',
          userColor: currentUser?.color || '#6366F1',
          position: e.selection.getPosition(),
          selection: {
            startLineNumber: e.selection.startLineNumber,
            startColumn: e.selection.startColumn,
            endLineNumber: e.selection.endLineNumber,
            endColumn: e.selection.endColumn
          }
        });
      });
    };

    initMonaco();

    return () => {
      isCancelled = true;
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
      }
    };
  }, []);

  // UPDATE MONACO MODEL LANGUAGE DYNAMICALLY WHENEVER LANGUAGE CHANGES (FEATURE 1 FIX)
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        const targetMonacoLang = getMonacoLang(activeLanguage);
        monacoRef.current.editor.setModelLanguage(model, targetMonacoLang);
      }
    }
  }, [activeLanguage]);

  // Socket event listeners for code change, cursor change, and initial socket data
  useEffect(() => {
    if (!socket || isReplayMode) return;

    const handleInitialCode = (data) => {
      if (!data) return;
      const targetLang = data.language || language;
      if (data.code !== undefined) {
        codeByLanguageRef.current[targetLang] = data.code;
        setCode(data.code);
      }
      if (data.language && data.language !== language) {
        setLanguage(data.language);
      }
    };

    const handleCodeChange = (data) => {
      if (!data || (data.code === undefined && data.code !== '')) return;
      const newCode = data.code;
      const newLang = data.language || language;

      codeByLanguageRef.current[newLang] = newCode;

      if (newLang !== language) {
        setLanguage(newLang);
      }
      setCode(newCode);

      if (onCodeChange) onCodeChange(newCode);
    };

    const handleCursorChange = (data) => {
      if (!data || !data.userId || !editorRef.current || !monacoRef.current || isReplayMode) return;
      const { userId, userName, userColor, position, selection } = data;

      const safeId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '');
      const color = userColor || '#6366F1';
      const name = userName || 'User';

      updateUserStyles(userId, color, name);

      const monaco = monacoRef.current;
      const newDecorations = [];

      if (position && position.lineNumber && position.column) {
        newDecorations.push({
          range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column + 1),
          options: {
            className: `remote-cursor-${safeId}`,
            hoverMessage: { value: `**${name}** is editing here` }
          }
        });
      }

      if (selection && (selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn)) {
        newDecorations.push({
          range: new monaco.Range(
            selection.startLineNumber,
            selection.startColumn,
            selection.endLineNumber,
            selection.endColumn
          ),
          options: {
            inlineClassName: `remote-selection-${safeId}`
          }
        });
      }

      const oldDecorations = decorationsRef.current[userId] || [];
      decorationsRef.current[userId] = editorRef.current.deltaDecorations(oldDecorations, newDecorations);
    };

    const handleUserLeft = (userId) => {
      if (decorationsRef.current[userId] && editorRef.current) {
        editorRef.current.deltaDecorations(decorationsRef.current[userId], []);
        delete decorationsRef.current[userId];
      }
    };

    socket.off('initial-code', handleInitialCode);
    socket.off('code-change', handleCodeChange);
    socket.off('cursor-change', handleCursorChange);
    socket.off('user-left', handleUserLeft);

    socket.on('initial-code', handleInitialCode);
    socket.on('code-change', handleCodeChange);
    socket.on('cursor-change', handleCursorChange);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('initial-code', handleInitialCode);
      socket.off('code-change', handleCodeChange);
      socket.off('cursor-change', handleCursorChange);
      socket.off('user-left', handleUserLeft);
    };
  }, [socket, code, language, onCodeChange, isReplayMode]);

  // Listen for real-time code execution events from any room participant
  useEffect(() => {
    if (!socket) return;

    const handleCodeExecuted = (data) => {
      if (data.executorName) setExecutedBy(data.executorName);
      if (data.output !== undefined) setConsoleOutput(data.output);
      if (data.error !== undefined) setConsoleError(data.error);
      if (data.status !== undefined) setConsoleStatus(data.status);
      if (data.duration !== undefined) setConsoleDuration(data.duration);
      setIsConsoleOpen(true);
    };

    socket.on('code-executed', handleCodeExecuted);
    return () => {
      socket.off('code-executed', handleCodeExecuted);
    };
  }, [socket]);

  // FEATURE 2 & FEATURE 3: Language Switching with Code Preservation & Default Templates
  const handleLanguageChange = (e) => {
    if (isReplayMode) return;
    const newLang = e.target.value;
    if (newLang === language) return;

    // Save current code for current language
    const currentVal = editorRef.current ? editorRef.current.getValue() : code;
    codeByLanguageRef.current[language] = currentVal;

    // Check if code exists for new language; if not, use default template
    let nextCode = codeByLanguageRef.current[newLang];
    if (nextCode === undefined || nextCode === null) {
      nextCode = DEFAULT_TEMPLATES[newLang] || `// ${newLang} Workspace\n`;
      codeByLanguageRef.current[newLang] = nextCode;
    }

    setLanguage(newLang);
    setCode(nextCode);

    if (editorRef.current && monacoRef.current) {
      isRemoteEditRef.current = true;
      editorRef.current.setValue(nextCode);
      isRemoteEditRef.current = false;

      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelLanguage(model, getMonacoLang(newLang));
      }
    }

    if (onCodeChange) onCodeChange(nextCode);
    socket?.emit('code-change', { roomId, code: nextCode, language: newLang });
  };

  // FEATURE 4 & FEATURE 5: Online Code Execution via Piston API
  const handleRunCode = async () => {
    if (isRunning || isReplayMode) return;
    const codeToRun = editorRef.current ? editorRef.current.getValue() : code;

    const executorName = currentUser?.displayName || currentUser?.name || currentUser?.username || 'User';
    setExecutedBy(executorName);

    setIsRunning(true);
    setIsConsoleOpen(true);
    setConsoleOutput('');
    setConsoleError('');
    setConsoleStatus('Executing...');
    setConsoleDuration('');

    try {
      const res = await executeCode(language, codeToRun);

      const outputText = res.output || '';
      const errorText = res.error || '';
      const statusText = res.status || (res.success ? 'Success' : 'Error');
      const durationText = res.duration || '';

      setConsoleOutput(outputText);
      setConsoleError(errorText);
      setConsoleStatus(statusText);
      setConsoleDuration(durationText);

      socket?.emit('code-executed', {
        roomId,
        executorName,
        output: outputText,
        error: errorText,
        status: statusText,
        duration: durationText
      });

      if (res.success) {
        toast.success(`Executed successfully (${durationText})`);
      } else {
        toast.error(`Execution failed (${statusText})`);
      }
    } catch (err) {
      console.error('Run code failed:', err);
      setConsoleError(`Execution Failed: ${err.message}`);
      setConsoleStatus('Execution Error');
    } finally {
      setIsRunning(false);
    }
  };

  // FEATURE 7: Clear Console (Clears only console output, NOT editor code)
  const handleClearConsole = () => {
    setConsoleOutput('');
    setConsoleError('');
    setConsoleStatus('');
    setConsoleDuration('');
    toast('Console cleared', { icon: '🧹' });
  };

  // Auto-scroll console output to bottom
  useEffect(() => {
    if (consoleBottomRef.current && isConsoleOpen) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleOutput, consoleError, isConsoleOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    toast.success('Code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#121212] rounded-2xl border border-white/10 overflow-hidden shadow-2xl relative">
      {/* Editor Header Toolbar */}
      <div className="h-11 bg-[#1A1A1A] border-b border-white/10 flex items-center justify-between px-3 z-10 select-none">
        <div className="flex items-center gap-2">
          <Code2 size={16} className="text-indigo-400" />
          <span className="text-xs font-semibold text-gray-300">Code Editor</span>
          {isReplayMode && (
            <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono flex items-center gap-1">
              <Lock size={10} /> READ-ONLY
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Language Selector Dropdown */}
          <select
            value={activeLanguage}
            onChange={handleLanguageChange}
            disabled={isReplayMode}
            className="bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-50 font-mono"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            title="Copy Code"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>

          {/* Console Toggle Button */}
          <button
            onClick={() => setIsConsoleOpen(!isConsoleOpen)}
            title={isConsoleOpen ? "Hide Console" : "Show Console"}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 border ${
              isConsoleOpen
                ? 'bg-purple-600/20 text-purple-300 border-purple-500/30'
                : 'text-gray-400 hover:bg-white/10 hover:text-white border-white/10'
            }`}
          >
            <Terminal size={14} />
          </button>

          {/* Maximize / Restore Button */}
          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              title={panelMode === 'code-max' ? 'Restore Split View' : 'Maximize Code Editor'}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs"
            >
              {panelMode === 'code-max' ? (
                <Minimize2 size={14} className="text-indigo-400" />
              ) : (
                <Maximize2 size={14} className="text-indigo-400" />
              )}
            </button>
          )}

          {/* FEATURE 4 — RUN BUTTON */}
          <button
            onClick={handleRunCode}
            disabled={isRunning || isReplayMode}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 border border-emerald-500/40"
            title="Execute Code Online"
          >
            {isRunning ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play size={13} className="fill-current text-white" />
                <span>Run</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading Overlay */}
      {!editorLoaded && (
        <div className="absolute inset-0 top-11 bg-[#0D0D0D] flex items-center justify-center gap-2 text-xs text-gray-400 font-mono z-20">
          <Loader2 size={16} className="animate-spin text-indigo-400" />
          <span>Loading Monaco Editor...</span>
        </div>
      )}

      {/* Main Monaco Container */}
      <div className="flex-1 w-full relative overflow-hidden bg-[#0D0D0D]">
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* FEATURE 6 — OUTPUT CONSOLE PANEL */}
      {isConsoleOpen && (
        <div className="h-44 bg-[#0A0A0E] border-t border-white/10 flex flex-col z-10 transition-all select-none">
          {/* Console Bar */}
          <div className="h-8 bg-[#14141F] border-b border-white/10 px-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={13} className="text-purple-400" />
              <span className="text-[11px] font-bold text-gray-300 tracking-wide uppercase">Output Console</span>

              {consoleStatus && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  consoleError
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                }`}>
                  {consoleStatus} {consoleDuration && `· ${consoleDuration}`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* FEATURE 7 — CLEAR CONSOLE BUTTON */}
              <button
                onClick={handleClearConsole}
                title="Clear Output Console"
                className="px-2 py-0.5 text-[10px] font-mono rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/10 cursor-pointer flex items-center gap-1"
              >
                <Trash2 size={11} />
                <span>Clear</span>
              </button>

              <button
                onClick={() => setIsConsoleOpen(false)}
                title="Minimize Console"
                className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          </div>

          {/* Console Content Area */}
          <div className="flex-1 p-3 overflow-y-auto font-mono text-xs text-gray-200 select-text bg-[#07070B] space-y-2">
            {isRunning ? (
              <div className="flex items-center gap-2 text-indigo-400 animate-pulse">
                <Loader2 size={13} className="animate-spin" />
                <span>Executing code via Piston Engine...</span>
              </div>
            ) : !consoleOutput && !consoleError && !consoleStatus ? (
              <div className="text-gray-600 italic text-[11px]">
                Click <strong className="text-emerald-400">Run</strong> to execute code and view output here.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Executor Display */}
                {executedBy && (
                  <div className="text-[11px] font-mono text-indigo-300 font-semibold mb-2">
                    Executed by: <span className="text-white font-bold">{executedBy}</span>
                  </div>
                )}

                {/* Standard Output */}
                {consoleOutput && (
                  <div>
                    <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-1">Program Output:</div>
                    <div className="text-gray-700 font-mono text-[10px] select-none">----------------</div>
                    <pre className="text-emerald-300 whitespace-pre-wrap font-mono leading-relaxed my-1">
                      {consoleOutput}
                    </pre>
                    <div className="text-gray-700 font-mono text-[10px] select-none">----------------</div>
                  </div>
                )}

                {/* Compilation / Runtime Errors */}
                {consoleError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-red-300 whitespace-pre-wrap font-mono text-[11px]">
                    <span className="font-bold text-red-400 block mb-1">ERRORS:</span>
                    {consoleError}
                  </div>
                )}
              </div>
            )}
            <div ref={consoleBottomRef} />
          </div>
        </div>
      )}
    </div>
  );
}
