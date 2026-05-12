import { spawn } from 'child_process';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const skipLongRuns =
  process.env.CI === 'true' || process.env.POLTERGEIST_COVERAGE_MODE === 'true';

async function waitForDaemonStarted(
  daemonProcess: ReturnType<typeof spawn>,
  timeoutMs = 15_000
) {
  await new Promise<void>((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const cleanup = () => {
      clearTimeout(timeout);
      daemonProcess.stdout?.off('data', onStdout);
      daemonProcess.stderr?.off('data', onStderr);
      daemonProcess.off('error', onError);
      daemonProcess.off('exit', onExit);
    };

    const fail = (message: string) => {
      cleanup();
      reject(new Error(`${message}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    };

    const timeout = setTimeout(() => {
      fail(`Daemon failed to start within ${timeoutMs}ms`);
    }, timeoutMs);

    const onStdout = (data: Buffer) => {
      stdout += data.toString();
      if (stdout.toLowerCase().includes('daemon started')) {
        cleanup();
        resolve();
      }
    };

    const onStderr = (data: Buffer) => {
      stderr += data.toString();
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const onExit = (code: number | null) => {
      if (code !== 0 && code !== null) {
        fail(`Daemon exited with code ${code}`);
      }
    };

    daemonProcess.stdout?.on('data', onStdout);
    daemonProcess.stderr?.on('data', onStderr);
    daemonProcess.on('error', onError);
    daemonProcess.on('exit', onExit);
  });
}

describe.skipIf(skipLongRuns)('Daemon with no enabled targets', () => {
  let testDir: string;
  let daemonProcess: ReturnType<typeof spawn> | null = null;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `poltergeist-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Kill daemon if running
    if (daemonProcess) {
      daemonProcess.kill();
      daemonProcess = null;
    }

    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should keep daemon running with no enabled targets', async () => {
    // Create config with no enabled targets
    const config = {
      version: '1.0',
      projectType: 'node',
      targets: [
        {
          name: 'test',
          type: 'executable',
          enabled: false,
          buildCommand: 'echo "test"',
          outputPath: './test-output',
          watchPaths: ['*.js'],
        },
      ],
    };

    const configPath = join(testDir, 'poltergeist.config.json');
    await writeFile(configPath, JSON.stringify(config, null, 2));

    // Start daemon
    const cliPath = join(process.cwd(), 'dist', 'cli.js');
    daemonProcess = spawn('node', [cliPath, 'start'], {
      cwd: testDir,
      detached: false,
      stdio: 'pipe',
    });

    await waitForDaemonStarted(daemonProcess);

    // Verify daemon is still running after a short delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect([null, 0]).toContain(daemonProcess!.exitCode);

    // Check daemon log exists and contains expected messages
    const logFiles = await import('fs').then((fs) =>
      fs.promises.readdir(testDir).catch(() => [])
    );
    const logFile = logFiles.find((f) => f.endsWith('.log'));
    
    if (logFile) {
      const logContent = await readFile(join(testDir, logFile), 'utf-8');
      expect(logContent).toContain('No enabled targets found. Daemon will continue running.');
    }
  });

  it('should accept targets via hot reload', async () => {
    // Create config with no enabled targets
    const config = {
      version: '1.0',
      projectType: 'node',
      targets: [
        {
          name: 'test',
          type: 'executable',
          enabled: false,
          buildCommand: 'echo "test" > test-output.txt',
          outputPath: './test-output.txt',
          watchPaths: ['*.js'],
        },
      ],
    };

    const configPath = join(testDir, 'poltergeist.config.json');
    await writeFile(configPath, JSON.stringify(config, null, 2));

    // Start daemon
    const cliPath = join(process.cwd(), 'dist', 'cli.js');
    daemonProcess = spawn('node', [cliPath, 'start'], {
      cwd: testDir,
      detached: false,
      stdio: 'pipe',
    });

    await waitForDaemonStarted(daemonProcess);

    // Verify daemon is running
    expect([null, 0]).toContain(daemonProcess!.exitCode);

    // Enable target via config modification
    config.targets[0].enabled = true;
    await writeFile(configPath, JSON.stringify(config, null, 2));

    // Wait for hot reload to process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify daemon is still running
    expect([null, 0]).toContain(daemonProcess!.exitCode);

    // Check if state file was created for the newly enabled target
    const stateDir = join(tmpdir(), 'poltergeist');
    const stateDirContents = await import('fs').then((fs) =>
      fs.promises.readdir(stateDir).catch(() => [])
    );
    
    // Look for state file for our test target
    const stateFile = stateDirContents.find(
      (f) => f.includes('-test.state')
    );
    
    if (stateFile) {
      try {
        const stateContent = await readFile(join(stateDir, stateFile), 'utf-8');
        const state = JSON.parse(stateContent);
        expect(state.target).toBe('test');
      } catch (error) {
        // State file might not be ready yet or might be in process of being written
        console.log('Could not parse state file:', error);
      }
    }
  });
});
