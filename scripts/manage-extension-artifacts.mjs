import fs from 'node:fs';
import path from 'node:path';

const variant = process.argv[2]; // 'chrome-saas' | 'chrome-oss' | 'firefox'
const action = process.argv[3] || 'build'; // 'build' | 'zip'

if (!variant) {
  console.error('[manage-extension-artifacts] Error: Missing variant argument.');
  process.exit(1);
}

const rootDir = process.cwd();
const outputDir = path.join(rootDir, '.output');
const distDir = path.join(rootDir, 'dist');
const artifactsDir = path.join(rootDir, 'extension-artifacts');

// Ensure base release artifact directories exist
const releasesDir = path.join(artifactsDir, 'releases');
const saasDir = path.join(releasesDir, 'chrome-saas');
const ossDir = path.join(releasesDir, 'chrome-oss');
const firefoxDir = path.join(releasesDir, 'firefox');
const devDir = path.join(artifactsDir, 'development', 'chrome-unpacked');

[
  path.join(saasDir, 'unpacked'),
  path.join(ossDir, 'unpacked'),
  path.join(firefoxDir, 'unpacked'),
  devDir
].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

if (variant === 'chrome-saas') {
  const srcUnpacked = path.join(outputDir, 'chrome-mv3');
  if (!fs.existsSync(srcUnpacked)) {
    console.error(`[manage-extension-artifacts] Error: Source output ${srcUnpacked} does not exist.`);
    process.exit(1);
  }

  const targetSaasUnpacked = path.join(saasDir, 'unpacked');

  // Clean old unpacked files in target locations
  fs.rmSync(targetSaasUnpacked, { recursive: true, force: true });
  fs.mkdirSync(targetSaasUnpacked, { recursive: true });

  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  // Copy unpacked build to extension-artifacts/releases/chrome-saas/unpacked
  fs.cpSync(srcUnpacked, targetSaasUnpacked, { recursive: true });
  console.log(`[manage-extension-artifacts] Copied Chrome SaaS unpacked build to ${targetSaasUnpacked}`);

  // Copy unpacked build directly to dist
  fs.cpSync(srcUnpacked, distDir, { recursive: true });
  console.log(`[manage-extension-artifacts] Copied Chrome SaaS unpacked build to ${distDir}`);

  // Verify manifest.json is present directly inside dist
  if (!fs.existsSync(path.join(distDir, 'manifest.json'))) {
    console.error(`[manage-extension-artifacts] Error: manifest.json is missing in ${distDir}`);
    process.exit(1);
  }

  // If action is zip, process zip files
  if (action === 'zip') {
    const files = fs.readdirSync(outputDir);
    const zipFile = files.find(f => f.endsWith('.zip') && !f.includes('sources') && !f.includes('-oss-') && !f.includes('-firefox'));
    if (zipFile) {
      const pkgJsonPath = path.join(rootDir, 'package.json');
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      const ver = pkgJson.version || '0.3.57';
      const targetZipName = `cmdos-${ver}-chrome-saas.zip`;
      const targetZipPath = path.join(saasDir, targetZipName);
      
      fs.copyFileSync(path.join(outputDir, zipFile), targetZipPath);
      console.log(`[manage-extension-artifacts] Saved Chrome SaaS ZIP to ${targetZipPath}`);
    } else {
      console.warn(`[manage-extension-artifacts] Warning: Chrome SaaS zip file not found in ${outputDir}`);
    }
  }
} else if (variant === 'chrome-standard') {
  const standardDir = path.join(releasesDir, 'chrome-standard');
  fs.mkdirSync(path.join(standardDir, 'unpacked'), { recursive: true });

  const srcUnpacked = path.join(outputDir, 'chrome-mv3');
  if (!fs.existsSync(srcUnpacked)) {
    console.error(`[manage-extension-artifacts] Error: Source output ${srcUnpacked} does not exist.`);
    process.exit(1);
  }

  const targetStandardUnpacked = path.join(standardDir, 'unpacked');

  fs.rmSync(targetStandardUnpacked, { recursive: true, force: true });
  fs.mkdirSync(targetStandardUnpacked, { recursive: true });

  fs.cpSync(srcUnpacked, targetStandardUnpacked, { recursive: true });
  console.log(`[manage-extension-artifacts] Copied Chrome Standard unpacked build to ${targetStandardUnpacked}`);

  // Copy unpacked build directly to dist
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
  fs.cpSync(srcUnpacked, distDir, { recursive: true });
  console.log(`[manage-extension-artifacts] Copied Chrome Standard unpacked build to ${distDir}`);

  if (action === 'zip') {
    const files = fs.readdirSync(outputDir);
    const zipFile = files.find(f => f.endsWith('.zip') && !f.includes('sources') && !f.includes('-oss-') && !f.includes('-saas-') && !f.includes('-firefox'));
    if (zipFile) {
      const pkgJsonPath = path.join(rootDir, 'package.json');
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      const ver = pkgJson.version || '0.3.57';
      const targetZipName = `cmdos-${ver}-chrome-standard.zip`;
      const targetZipPath = path.join(standardDir, targetZipName);
      
      fs.copyFileSync(path.join(outputDir, zipFile), targetZipPath);
      console.log(`[manage-extension-artifacts] Saved Chrome Standard ZIP to ${targetZipPath}`);
    } else {
      console.warn(`[manage-extension-artifacts] Warning: Chrome Standard zip file not found in ${outputDir}`);
    }
  }
} else if (variant === 'chrome-oss') {
  const srcUnpacked = path.join(outputDir, 'chrome-mv3');
  if (!fs.existsSync(srcUnpacked)) {
    console.error(`[manage-extension-artifacts] Error: Source output ${srcUnpacked} does not exist.`);
    process.exit(1);
  }

  const targetOssUnpacked = path.join(ossDir, 'unpacked');

  fs.rmSync(targetOssUnpacked, { recursive: true, force: true });
  fs.mkdirSync(targetOssUnpacked, { recursive: true });

  fs.cpSync(srcUnpacked, targetOssUnpacked, { recursive: true });
  console.log(`[manage-extension-artifacts] Copied Chrome OSS unpacked build to ${targetOssUnpacked}`);

  if (action === 'zip') {
    const files = fs.readdirSync(outputDir);
    const zipFile = files.find(f => f.endsWith('.zip') && !f.includes('sources') && !f.includes('-saas-') && !f.includes('-firefox'));
    if (zipFile) {
      const pkgJsonPath = path.join(rootDir, 'package.json');
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      const ver = pkgJson.version || '0.3.57';
      const targetZipName = `cmdos-${ver}-chrome-oss.zip`;
      const targetZipPath = path.join(ossDir, targetZipName);
      
      fs.copyFileSync(path.join(outputDir, zipFile), targetZipPath);
      console.log(`[manage-extension-artifacts] Saved Chrome OSS ZIP to ${targetZipPath}`);
    } else {
      console.warn(`[manage-extension-artifacts] Warning: Chrome OSS zip file not found in ${outputDir}`);
    }
  }
} else if (variant === 'firefox') {
  const srcUnpacked = path.join(outputDir, 'firefox-mv2');
  if (!fs.existsSync(srcUnpacked)) {
    console.error(`[manage-extension-artifacts] Error: Source output ${srcUnpacked} does not exist.`);
    process.exit(1);
  }

  const targetFirefoxUnpacked = path.join(firefoxDir, 'unpacked');

  fs.rmSync(targetFirefoxUnpacked, { recursive: true, force: true });
  fs.mkdirSync(targetFirefoxUnpacked, { recursive: true });

  fs.cpSync(srcUnpacked, targetFirefoxUnpacked, { recursive: true });
  console.log(`[manage-extension-artifacts] Copied Firefox unpacked build to ${targetFirefoxUnpacked}`);

  if (action === 'zip') {
    const files = fs.readdirSync(outputDir);
    const mainZip = files.find(f => f.endsWith('.zip') && !f.includes('sources') && (f.includes('firefox') || f.includes('cmdos')));
    const sourcesZip = files.find(f => f.endsWith('.zip') && f.includes('sources'));

    const pkgJsonPath = path.join(rootDir, 'package.json');
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const ver = pkgJson.version || '0.3.57';

    if (mainZip) {
      const targetZipName = `cmdos-${ver}-firefox.zip`;
      const targetZipPath = path.join(firefoxDir, targetZipName);
      fs.copyFileSync(path.join(outputDir, mainZip), targetZipPath);
      console.log(`[manage-extension-artifacts] Saved Firefox ZIP to ${targetZipPath}`);
    }

    if (sourcesZip) {
      const targetSourcesZipName = `cmdos-${ver}-firefox-sources.zip`;
      const targetSourcesZipPath = path.join(firefoxDir, targetSourcesZipName);
      fs.copyFileSync(path.join(outputDir, sourcesZip), targetSourcesZipPath);
      console.log(`[manage-extension-artifacts] Saved Firefox Sources ZIP to ${targetSourcesZipPath}`);
    }
  }
}
