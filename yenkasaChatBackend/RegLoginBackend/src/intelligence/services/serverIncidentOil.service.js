const os = require('node:os');
const util = require('node:util');

const { publishIntelligenceEvent } = require('./eventPublisher.service');

const DEFAULT_LEVELS = new Set(['error', 'warn']);
const SKIPPED_PREFIXES = [
  '[YenkasaAIEventRelay]',
  '[YenkasaServerIncidentOIL]',
];

let installed = false;
let suppressCapture = false;

function parseEnabledLevels() {
  const configured = String(process.env.YENKASA_SERVER_LOG_OIL_LEVELS || '')
    .split(',')
    .map((level) => level.trim().toLowerCase())
    .filter(Boolean);

  return new Set(configured.length > 0 ? configured : DEFAULT_LEVELS);
}

function serializeArg(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      code: value.code || null,
      status: value.status || null,
    };
  }

  if (typeof value === 'string') return value;

  return util.inspect(value, {
    depth: 8,
    breakLength: 160,
    maxArrayLength: 100,
    maxStringLength: 12000,
  });
}

function buildMessage(args = []) {
  return args.map(serializeArg).join(' ').slice(0, 24000);
}

function shouldSkipMessage(message) {
  return SKIPPED_PREFIXES.some((prefix) => message.startsWith(prefix));
}

function publishServerIncident({ level, incidentType, args = [], sourceFile = 'src/server.js' }) {
  if (process.env.YENKASA_SERVER_INCIDENT_OIL_ENABLED === 'false') return;

  const message = buildMessage(args);
  if (!message || shouldSkipMessage(message)) return;

  const errorArg = args.find((arg) => arg instanceof Error);
  const timestamp = new Date().toISOString();

  suppressCapture = true;
  try {
    publishIntelligenceEvent({
      eventType: 'server_incident',
      source: 'yenkasa_server',
      timestamp,
      metadata: {
        component: 'server.js',
        severity: level,
        incidentType,
        message,
        logArguments: args.map(serializeArg),
        stack: errorArg?.stack || '',
        pid: process.pid,
        hostname: os.hostname(),
        nodeEnv: process.env.NODE_ENV || '',
        sourceFile,
      },
    });
  } finally {
    suppressCapture = false;
  }
}

function patchConsole(level, enabledLevels) {
  const original = console[level];
  if (typeof original !== 'function' || !enabledLevels.has(level)) return;

  console[level] = (...args) => {
    original.apply(console, args);

    if (suppressCapture) return;
    publishServerIncident({
      level,
      incidentType: 'console',
      args,
    });
  };
}

function installProcessHandlers() {
  process.on('unhandledRejection', (reason) => {
    publishServerIncident({
      level: 'error',
      incidentType: 'unhandled_rejection',
      args: ['Unhandled promise rejection in server.js process.', reason],
    });
  });

  process.on('uncaughtExceptionMonitor', (error) => {
    publishServerIncident({
      level: 'error',
      incidentType: 'uncaught_exception',
      args: ['Uncaught exception in server.js process.', error],
    });
  });

  process.on('warning', (warning) => {
    publishServerIncident({
      level: 'warn',
      incidentType: 'process_warning',
      args: ['Node process warning in server.js process.', warning],
    });
  });
}

function installServerIncidentOilBridge() {
  if (installed) {
    return {
      installed: true,
      duplicateInstall: true,
      enabled: process.env.YENKASA_SERVER_INCIDENT_OIL_ENABLED !== 'false',
    };
  }

  installed = true;
  const enabledLevels = parseEnabledLevels();
  patchConsole('error', enabledLevels);
  patchConsole('warn', enabledLevels);
  patchConsole('log', enabledLevels);
  patchConsole('info', enabledLevels);
  installProcessHandlers();

  return {
    installed: true,
    duplicateInstall: false,
    enabled: process.env.YENKASA_SERVER_INCIDENT_OIL_ENABLED !== 'false',
    capturedConsoleLevels: Array.from(enabledLevels),
  };
}

module.exports = {
  installServerIncidentOilBridge,
  publishServerIncident,
};
