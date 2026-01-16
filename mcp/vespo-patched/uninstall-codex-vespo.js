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
  chromaImagePinned: 'chromadb/chroma:0.5.23',
  volumeName: 'chromadb-vespo-data',
  serverName: 'chromadb_context_vespo',
  dockerWrapperPathUnix: path.join(os.homedir(), '.codex', 'docker-wrapper.sh'),
  dockerWrapperPathWindows: path.join(os.homedir(), '.codex', 'docker-wrapper.ps1'),
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

function volumeExists(name) {
  try {
    const result = runCommand('docker', ['volume', 'ls', '--format', '{{.Name}}']);
    return result.stdout.split('\n').includes(name);
  } catch {
    return false;
  }
}

function findOrphanedMcpContainers() {
  // Find containers created from the MCP image that may have auto-generated names
  try {
    const result = runCommand('docker', [
      'ps', '-a',
      '--filter', 'ancestor=chroma-mcp-vespo-patched:latest',
      '--format', '{{.Names}}'
    ]);
    return result.stdout.split('\n').filter(name => name.trim() !== '');
  } catch {
    return [];
  }
}

function findOrphanedChromaContainers() {
  // Find chromadb containers that might have different names
  try {
    const result = runCommand('docker', [
      'ps', '-a',
      '--filter', 'ancestor=chromadb/chroma',
      '--format', '{{.Names}}'
    ]);
    return result.stdout.split('\n').filter(name => name.trim() !== '');
  } catch {
    return [];
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

function removeVolume(name) {
  if (!volumeExists(name)) {
    logInfo(`Volume '${name}' not found, skipping.`);
    return;
  }

  try {
    logInfo(`Removing volume '${name}'...`);
    runCommand('docker', ['volume', 'rm', name]);
    logSuccess(`Volume '${name}' removed.`);
  } catch (error) {
    logWarn(`Failed to remove volume '${name}': ${error.message}`);
  }
}

function removeDockerWrapper() {
  let removed = false;

  // Try to remove Unix wrapper
  if (fs.existsSync(CONFIG.dockerWrapperPathUnix)) {
    try {
      fs.unlinkSync(CONFIG.dockerWrapperPathUnix);
      logSuccess('Docker wrapper script (bash) removed.');
      removed = true;
    } catch (error) {
      logWarn(`Failed to remove bash wrapper: ${error.message}`);
    }
  }

  // Try to remove Windows wrapper
  if (fs.existsSync(CONFIG.dockerWrapperPathWindows)) {
    try {
      fs.unlinkSync(CONFIG.dockerWrapperPathWindows);
      logSuccess('Docker wrapper script (PowerShell) removed.');
      removed = true;
    } catch (error) {
      logWarn(`Failed to remove PowerShell wrapper: ${error.message}`);
    }
  }

  if (!removed) {
    logInfo('Docker wrapper scripts not found, skipping.');
  }
}

function cleanCodexConfig() {
  if (!fs.existsSync(CONFIG.configPath)) {
    logInfo('Codex config not found, skipping.');
    return;
  }

  try {
    let config = fs.readFileSync(CONFIG.configPath, 'utf-8');
    const originalConfig = config;

    // Find and remove the chromadb_context_vespo section
    // Support multiple possible markers/formats from different versions
    const startMarkers = [
      '# Patched vespo92 ChromaDB MCP server',
      '# ChromaDB MCP Server',
      '[mcp_servers.chromadb_context_vespo]',
      '[mcp_servers.chromadb-vespo]',
      '[mcp_servers.chromadb_vespo]'
    ];

    let modified = false;
    for (const marker of startMarkers) {
      let startIdx = config.indexOf(marker);
      while (startIdx !== -1) {
        // Find the start of the section (including comments above)
        let sectionStart = startIdx;
        const lines = config.substring(0, startIdx).split('\n');

        // Go back to find comment lines that belong to this section
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.startsWith('#') || line === '') {
            // Only include if it's a related comment
            if (line.toLowerCase().includes('chroma') || line.toLowerCase().includes('vespo') || line === '') {
              sectionStart = config.lastIndexOf(lines[i], startIdx);
            }
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

        // Look for more occurrences
        startIdx = config.indexOf(marker);
      }
    }

    if (modified) {
      // Clean up extra blank lines
      config = config.replace(/\n{3,}/g, '\n\n').trim() + '\n';

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
  let dockerAvailable = true;
  try {
    runCommand('docker', ['--version']);
  } catch {
    logWarn('Docker is not installed or not in PATH. Skipping Docker cleanup.');
    dockerAvailable = false;
  }

  let removeContainers = false;
  let removeImages = false;
  let removeVolumes = false;
  let orphanedMcpContainers = [];
  let orphanedChromaContainers = [];

  if (dockerAvailable) {
    // Find orphaned containers (auto-named from multi-workspace setup)
    orphanedMcpContainers = findOrphanedMcpContainers();
    orphanedChromaContainers = findOrphanedChromaContainers();

    // Show what we found
    console.log();
    logInfo('=== Detected Components ===');

    const knownContainers = [];
    if (containerExists(CONFIG.containerName)) knownContainers.push(CONFIG.containerName);
    if (containerExists(CONFIG.mcpContainerName)) knownContainers.push(CONFIG.mcpContainerName);

    const allOrphanedContainers = [...new Set([...orphanedMcpContainers, ...orphanedChromaContainers])];

    if (knownContainers.length > 0) {
      logInfo(`  Known containers: ${knownContainers.join(', ')}`);
    }
    if (allOrphanedContainers.length > 0) {
      logInfo(`  Additional containers (auto-named): ${allOrphanedContainers.join(', ')}`);
    }
    if (imageExists(CONFIG.imageName)) logInfo(`  Image: ${CONFIG.imageName}`);
    if (imageExists(CONFIG.chromaImageName)) logInfo(`  Image: ${CONFIG.chromaImageName}`);
    if (imageExists(CONFIG.chromaImagePinned)) logInfo(`  Image: ${CONFIG.chromaImagePinned}`);
    if (volumeExists(CONFIG.volumeName)) logInfo(`  Volume: ${CONFIG.volumeName} (contains your indexed data)`);
    if (networkExists(CONFIG.networkName)) logInfo(`  Network: ${CONFIG.networkName}`);

    // Prompt for containers
    const totalContainers = knownContainers.length + allOrphanedContainers.length;
    if (totalContainers > 0) {
      console.log();
      removeContainers = await confirm(
        `Remove Docker containers (${totalContainers} found)?`,
        true
      );
    }

    // Prompt for images
    const hasImages = imageExists(CONFIG.imageName) || imageExists(CONFIG.chromaImageName) || imageExists(CONFIG.chromaImagePinned);
    if (hasImages) {
      console.log();
      removeImages = await confirm(
        'Remove Docker images (chroma-mcp-vespo-patched, chromadb/chroma)?',
        false
      );
    }

    // Prompt for volumes (important - contains data!)
    if (volumeExists(CONFIG.volumeName)) {
      console.log();
      logWarn('The ChromaDB volume contains all your indexed data (collections, embeddings).');
      removeVolumes = await confirm(
        'Remove ChromaDB data volume? (WARNING: This deletes all indexed data!)',
        false
      );
    }
  }

  if (dockerAvailable && removeContainers) {
    console.log();
    logInfo('=== Removing Docker Containers ===');

    // Remove known containers
    stopAndRemoveContainer(CONFIG.containerName);
    stopAndRemoveContainer(CONFIG.mcpContainerName);

    // Remove orphaned containers
    const allOrphanedContainers = [...new Set([...orphanedMcpContainers, ...orphanedChromaContainers])];
    for (const container of allOrphanedContainers) {
      if (container !== CONFIG.containerName && container !== CONFIG.mcpContainerName) {
        stopAndRemoveContainer(container);
      }
    }
  }

  if (dockerAvailable && removeImages) {
    console.log();
    logInfo('=== Removing Docker Images ===');
    removeImage(CONFIG.imageName);
    removeImage(CONFIG.chromaImageName);
    removeImage(CONFIG.chromaImagePinned);
  }

  if (dockerAvailable && removeVolumes) {
    console.log();
    logInfo('=== Removing Docker Volume ===');
    removeVolume(CONFIG.volumeName);
  }

  // Always remove network if no containers are using it
  if (dockerAvailable) {
    console.log();
    logInfo('=== Removing Docker Network ===');
    removeNetwork(CONFIG.networkName);
  }

  // Always remove docker wrapper
  console.log();
  logInfo('=== Removing Docker Wrapper Scripts ===');
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
  if (removeVolumes) {
    console.log('  ✓ Docker volume removed (data deleted)');
  } else if (volumeExists(CONFIG.volumeName)) {
    console.log('  ⚠ Docker volume preserved (your data is still available)');
  }
  if (dockerAvailable) {
    console.log('  ✓ Docker network removed (if unused)');
  }
  console.log('  ✓ Docker wrapper scripts removed');
  console.log('  ✓ Codex CLI configuration cleaned');
  console.log();
  logWarn('Please restart VS Code to apply Codex CLI configuration changes.');
  console.log();
}

main().catch(error => {
  logError(`Uninstall failed: ${error.message}`);
  process.exit(1);
});
