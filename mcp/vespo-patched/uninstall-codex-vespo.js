#!/usr/bin/env node

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';

const CONFIG = {
  networkName: 'chroma-net',
  containerName: 'chromadb-vespo',
  mcpContainerName: 'chromadb-mcp-server',
  imageName: 'chroma-mcp-vespo-patched:latest',
  chromaImageName: 'chromadb/chroma:latest',
  serverName: 'chromadb_context_vespo',
  dockerWrapperPath: path.join(os.homedir(), '.codex', 'docker-wrapper.sh'),
  configPath: path.join(os.homedir(), '.codex', 'config.toml')
};

const IS_WINDOWS = process.platform === 'win32';

function logInfo(message) {
  console.log(`\x1b[36m${message}\x1b[0m`);
}

function logSuccess(message) {
  console.log(`\x1b[32m✓ ${message}\x1b[0m`);
}

function logWarn(message) {
  console.warn(`\x1b[33m⚠ ${message}\x1b[0m`);
}

function logError(message) {
  console.error(`\x1b[31m✗ ${message}\x1b[0m`);
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.stdio ?? 'pipe',
    encoding: 'utf-8',
    shell: IS_WINDOWS
  });

  if (result.error) {
    throw new Error(`Failed to run ${command}: ${result.error.message}`);
  }

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status
  };
}

function confirm(question, defaultValue = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const defaultText = defaultValue ? '[Y/n]' : '[y/N]';

  return new Promise((resolve) => {
    rl.question(`${question} ${defaultText}: `, (answer) => {
      rl.close();
      if (answer.trim() === '') {
        resolve(defaultValue);
      } else {
        resolve(answer.toLowerCase().startsWith('y'));
      }
    });
  });
}

function containerExists(name) {
  try {
    const result = runCommand('docker', ['ps', '-a', '--format', '{{.Names}}']);
    return result.stdout.split('\n').includes(name);
  } catch {
    return false;
  }
}

function imageExists(name) {
  try {
    const result = runCommand('docker', ['images', '--format', '{{.Repository}}:{{.Tag}}']);
    return result.stdout.split('\n').includes(name);
  } catch {
    return false;
  }
}

function networkExists(name) {
  try {
    const result = runCommand('docker', ['network', 'ls', '--format', '{{.Name}}']);
    return result.stdout.split('\n').includes(name);
  } catch {
    return false;
  }
}

function stopAndRemoveContainer(name) {
  if (!containerExists(name)) {
    logInfo(`Container '${name}' not found, skipping.`);
    return;
  }

  try {
    logInfo(`Stopping container '${name}'...`);
    runCommand('docker', ['stop', name]);
    logInfo(`Removing container '${name}'...`);
    runCommand('docker', ['rm', name]);
    logSuccess(`Container '${name}' removed.`);
  } catch (error) {
    logWarn(`Failed to remove container '${name}': ${error.message}`);
  }
}

function removeImage(name) {
  if (!imageExists(name)) {
    logInfo(`Image '${name}' not found, skipping.`);
    return;
  }

  try {
    logInfo(`Removing image '${name}'...`);
    runCommand('docker', ['rmi', name]);
    logSuccess(`Image '${name}' removed.`);
  } catch (error) {
    logWarn(`Failed to remove image '${name}': ${error.message}`);
  }
}

function removeNetwork(name) {
  if (!networkExists(name)) {
    logInfo(`Network '${name}' not found, skipping.`);
    return;
  }

  try {
    logInfo(`Removing network '${name}'...`);
    runCommand('docker', ['network', 'rm', name]);
    logSuccess(`Network '${name}' removed.`);
  } catch (error) {
    logWarn(`Failed to remove network '${name}': ${error.message}`);
  }
}

function removeDockerWrapper() {
  if (!fs.existsSync(CONFIG.dockerWrapperPath)) {
    logInfo('Docker wrapper script not found, skipping.');
    return;
  }

  try {
    fs.unlinkSync(CONFIG.dockerWrapperPath);
    logSuccess('Docker wrapper script removed.');
  } catch (error) {
    logWarn(`Failed to remove docker wrapper: ${error.message}`);
  }
}

function cleanCodexConfig() {
  if (!fs.existsSync(CONFIG.configPath)) {
    logInfo('Codex config not found, skipping.');
    return;
  }

  try {
    let config = fs.readFileSync(CONFIG.configPath, 'utf-8');

    // Find and remove the chromadb_context_vespo section
    const startMarkers = [
      '# Patched vespo92 ChromaDB MCP server',
      '[mcp_servers.chromadb_context_vespo]'
    ];

    let modified = false;
    for (const marker of startMarkers) {
      const startIdx = config.indexOf(marker);
      if (startIdx !== -1) {
        // Find the start of the section (including comments above)
        let sectionStart = startIdx;
        const lines = config.substring(0, startIdx).split('\n');

        // Go back to find comment lines
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.startsWith('#') || line === '') {
            sectionStart = config.lastIndexOf(lines[i], startIdx);
          } else {
            break;
          }
        }

        // Find the end of the section (next section or end of file)
        let sectionEnd = config.length;
        const nextSection = config.indexOf('\n[', startIdx + 1);
        if (nextSection !== -1) {
          sectionEnd = nextSection;
        }

        // Remove the section
        config = config.substring(0, sectionStart) + config.substring(sectionEnd);
        modified = true;
        break;
      }
    }

    if (modified) {
      // Clean up extra blank lines
      config = config.replace(/\n{3,}/g, '\n\n');

      fs.writeFileSync(CONFIG.configPath, config, 'utf-8');
      logSuccess('Codex config cleaned.');
    } else {
      logInfo('No ChromaDB MCP configuration found in Codex config.');
    }
  } catch (error) {
    logError(`Failed to clean Codex config: ${error.message}`);
  }
}

async function main() {
  console.log('\x1b[1m\x1b[36m');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  ChromaDB MCP Server - Uninstall Script               ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('\x1b[0m');

  logInfo('This script will remove ChromaDB MCP Server components.');
  console.log();

  // Check Docker
  try {
    runCommand('docker', ['--version']);
  } catch {
    logError('Docker is not installed or not in PATH.');
    process.exit(1);
  }

  // Prompt for containers
  const removeContainers = await confirm(
    'Remove Docker containers (chromadb-vespo, chromadb-mcp-server)?',
    true
  );

  if (removeContainers) {
    console.log();
    logInfo('=== Removing Docker Containers ===');
    stopAndRemoveContainer(CONFIG.containerName);
    stopAndRemoveContainer(CONFIG.mcpContainerName);
  }

  // Prompt for images
  console.log();
  const removeImages = await confirm(
    'Remove Docker images (chroma-mcp-vespo-patched, chromadb/chroma)?',
    false
  );

  if (removeImages) {
    console.log();
    logInfo('=== Removing Docker Images ===');
    removeImage(CONFIG.imageName);
    removeImage(CONFIG.chromaImageName);
  }

  // Always remove network if no containers are using it
  console.log();
  logInfo('=== Removing Docker Network ===');
  removeNetwork(CONFIG.networkName);

  // Always remove docker wrapper
  console.log();
  logInfo('=== Removing Docker Wrapper Script ===');
  removeDockerWrapper();

  // Always clean Codex config
  console.log();
  logInfo('=== Cleaning Codex CLI Configuration ===');
  cleanCodexConfig();

  console.log();
  console.log('\x1b[1m\x1b[32m');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  Uninstall Complete!                                   ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('\x1b[0m');

  console.log();
  logInfo('Summary of actions:');
  if (removeContainers) {
    console.log('  ✓ Docker containers removed');
  }
  if (removeImages) {
    console.log('  ✓ Docker images removed');
  }
  console.log('  ✓ Docker network removed (if unused)');
  console.log('  ✓ Docker wrapper script removed');
  console.log('  ✓ Codex CLI configuration cleaned');
  console.log();
  logWarn('Please restart VS Code to apply Codex CLI configuration changes.');
  console.log();
}

main().catch(error => {
  logError(`Uninstall failed: ${error.message}`);
  process.exit(1);
});
