import fs from 'node:fs';
import path from 'node:path';

const variant = process.argv[2]; // 'chrome-saas' | 'chrome-oss' | 'firefox'
const action = process.argv[3] || 'build'; // 'build' | 'zip'

if (!variant) {
  console.error('[manage-extension-artifacts] Error: Missing variant argument.');
  process.exit(1);
}

const rootDir = fs.realpathSync(process.cwd());
const outputDir = path.join(rootDir, '.output');
const distDir = path.join(rootDir, 'dist');
const artifactsDir = path.join(rootDir, 'extension-artifacts');

/** Validate actual/lexical targets before recursively replacing managed packages. */
const resetManagedDirectory = directory => {
  const insideRoot = target => {
    const relative = path.relative(rootDir, target);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  };
  const resolved = path.resolve(directory);
  if (!insideRoot(resolved) || (fs.existsSync(resolved) && !insideRoot(fs.realpathSync(resolved)))) {
    throw new Error(`[manage-extension-artifacts] Refusing to replace an artifact outside the workspace: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
  fs.mkdirSync(resolved, { recursive: true });
};

// Ensure base release artifact directories exist
const releasesDir = path.join(artifactsDir, 'releases');
const saasDir = path.join(releasesDir, 'chrome-saas');
const ossDir = path.join(releasesDir, 'chrome-oss');
const firefoxDir = path.join(releasesDir, 'firefox');
const devDir = path.join(artifactsDir, 'development', 'chrome-unpacked');

const listFilesRecursively = directory =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFilesRecursively(entryPath) : [entryPath];
  });

const assertPopupArtifact = unpackedDir => {
  const manifestPath = path.join(unpackedDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const commandNames = Object.keys(manifest.commands || {});
  const commandSearch = manifest.commands?.open_alts;

  if (
    commandNames.length !== 1 ||
    commandNames[0] !== 'open_alts' ||
    commandSearch?.description !== 'Alt + S Search' ||
    commandSearch?.suggested_key?.default !== 'Alt+S'
  ) {
    throw new Error(
      '[manage-extension-artifacts] popup release must expose one open_alts command named Alt + S Search with Alt+S.',
    );
  }

  if (fs.existsSync(path.join(unpackedDir, 'alt-s-website.js'))) {
    throw new Error(
      '[manage-extension-artifacts] popup release unexpectedly contains the legacy website popup entrypoint.',
    );
  }

  const javascriptFiles = listFilesRecursively(unpackedDir).filter(file => file.endsWith('.js'));
  const legacyPopupMarkers = ['AltS ErrorBoundary', 'shadow-root-app-container'];
  const containsLegacyPopup = javascriptFiles.some(file => {
    const source = fs.readFileSync(file, 'utf8');
    return legacyPopupMarkers.some(marker => source.includes(marker));
  });
  if (containsLegacyPopup) {
    throw new Error(
      '[manage-extension-artifacts] popup release unexpectedly contains legacy website popup runtime code.',
    );
  }

  const contentScriptPath = path.join(unpackedDir, 'content-scripts', 'content.js');
  const backgroundPath = path.join(unpackedDir, 'background.js');
  const contentScript = fs.readFileSync(contentScriptPath, 'utf8');
  const background = fs.readFileSync(backgroundPath, 'utf8');
  if (!contentScript.includes('data-alts-runtime') || !background.includes('toggle-alts')) {
    throw new Error('[manage-extension-artifacts] popup release is missing the popup website popup runtime or route.');
  }
  if (!background.includes('collection_element_snapshot_get') || !/["']snapshot["']\s*,\s*["']snapshotImages["']/.test(background)) {
    throw new Error('[manage-extension-artifacts] popup release is missing the current Element clip snapshot save/read contract. Build the current source before publishing.');
  }
  const newtabPage = manifest.chrome_url_overrides?.newtab;
  if (!newtabPage) {
    throw new Error('[manage-extension-artifacts] popup release is missing the new-tab page.');
  }
  const newtabHtml = fs.readFileSync(path.join(unpackedDir, newtabPage), 'utf8');
  const moduleScriptTag = [...newtabHtml.matchAll(/<script\b[^>]*>/g)]
    .map(match => match[0])
    .find(tag => /\btype="module"/.test(tag));
  const newtabEntryPath = moduleScriptTag?.match(/\bsrc="\/([^"]+\.js)"/)?.[1];
  if (!newtabEntryPath) {
    throw new Error('[manage-extension-artifacts] popup release is missing the new-tab entry script.');
  }
  const newtabEntry = fs.readFileSync(path.join(unpackedDir, newtabEntryPath), 'utf8');
  if (
    !background.includes('open_popup=true') ||
    !newtabEntry.includes('open_popup') ||
    !newtabEntry.includes('toggleWebsitePopupLayer')
  ) {
    throw new Error('[manage-extension-artifacts] popup release is missing the new-tab popup route.');
  }
  if (background.includes('force_board_view=true') || newtabEntry.includes('force_board_view=true')) {
    throw new Error('[manage-extension-artifacts] popup release still contains the retired new-tab Board View shortcut route.');
  }

  console.log('[manage-extension-artifacts] Verified popup release popup-only Alt + S Search artifact.');
};

[path.join(saasDir, 'unpacked'), path.join(ossDir, 'unpacked'), path.join(firefoxDir, 'unpacked'), devDir].forEach(
  dir => fs.mkdirSync(dir, { recursive: true }),
);

if (variant === 'chrome-saas') {
  const srcUnpacked = path.join(outputDir, 'chrome-mv3');
  if (!fs.existsSync(srcUnpacked)) {
    console.error(`[manage-extension-artifacts] Error: Source output ${srcUnpacked} does not exist.`);
    process.exit(1);
  }

  assertPopupArtifact(srcUnpacked);

  const targetSaasUnpacked = path.join(saasDir, 'unpacked');

  // Clean old unpacked files in target locations
  resetManagedDirectory(targetSaasUnpacked);

  resetManagedDirectory(distDir);

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
    const zipFile = files.find(
      f => f.endsWith('.zip') && !f.includes('sources') && !f.includes('-oss-') && !f.includes('-firefox'),
    );
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

  assertPopupArtifact(srcUnpacked);

  const targetStandardUnpacked = path.join(standardDir, 'unpacked');

  resetManagedDirectory(targetStandardUnpacked);

  fs.cpSync(srcUnpacked, targetStandardUnpacked, { recursive: true });
  console.log(`[manage-extension-artifacts] Copied popup release unpacked build to ${targetStandardUnpacked}`);

  // Copy unpacked build directly to dist
  resetManagedDirectory(distDir);
  fs.cpSync(srcUnpacked, distDir, { recursive: true });
  console.log(`[manage-extension-artifacts] Copied popup release unpacked build to ${distDir}`);

  if (action === 'zip') {
    const files = fs.readdirSync(outputDir);
    const zipFile = files.find(
      f =>
        f.endsWith('.zip') &&
        !f.includes('sources') &&
        !f.includes('-oss-') &&
        !f.includes('-saas-') &&
        !f.includes('-firefox'),
    );
    if (zipFile) {
      const pkgJsonPath = path.join(rootDir, 'package.json');
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      const ver = pkgJson.version || '0.3.57';
      const targetZipName = `cmdos-${ver}-chrome-standard.zip`;
      const targetZipPath = path.join(standardDir, targetZipName);

      fs.copyFileSync(path.join(outputDir, zipFile), targetZipPath);
      console.log(`[manage-extension-artifacts] Saved popup release ZIP to ${targetZipPath}`);
    } else {
      console.warn(`[manage-extension-artifacts] Warning: popup release zip file not found in ${outputDir}`);
    }
  }
} else if (variant === 'chrome-oss') {
  const srcUnpacked = path.join(outputDir, 'chrome-mv3');
  if (!fs.existsSync(srcUnpacked)) {
    console.error(`[manage-extension-artifacts] Error: Source output ${srcUnpacked} does not exist.`);
    process.exit(1);
  }

  assertPopupArtifact(srcUnpacked);

  const targetOssUnpacked = path.join(ossDir, 'unpacked');

  resetManagedDirectory(targetOssUnpacked);

  fs.cpSync(srcUnpacked, targetOssUnpacked, { recursive: true });
  console.log(`[manage-extension-artifacts] Copied Chrome OSS unpacked build to ${targetOssUnpacked}`);

  if (action === 'zip') {
    const files = fs.readdirSync(outputDir);
    const zipFile = files.find(f => f === 'chrome-mv3.zip');
    if (zipFile) {
      const pkgJsonPath = path.join(rootDir, 'package.json');
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      const ver = pkgJson.version || '0.3.57';
      const targetZipName = `cmdos-${ver}-chrome-oss.zip`;
      const targetZipPath = path.join(ossDir, targetZipName);

      fs.copyFileSync(path.join(outputDir, zipFile), targetZipPath);
      console.log(`[manage-extension-artifacts] Saved Chrome OSS ZIP to ${targetZipPath}`);
    } else {
      throw new Error(`[manage-extension-artifacts] Chrome OSS chrome-mv3.zip file not found in ${outputDir}`);
    }
  }
} else if (variant === 'firefox') {
  const srcUnpacked = path.join(outputDir, 'firefox-mv2');
  if (!fs.existsSync(srcUnpacked)) {
    console.error(`[manage-extension-artifacts] Error: Source output ${srcUnpacked} does not exist.`);
    process.exit(1);
  }

  assertPopupArtifact(srcUnpacked);

  const targetFirefoxUnpacked = path.join(firefoxDir, 'unpacked');

  fs.rmSync(targetFirefoxUnpacked, { recursive: true, force: true });
  fs.mkdirSync(targetFirefoxUnpacked, { recursive: true });

  fs.cpSync(srcUnpacked, targetFirefoxUnpacked, { recursive: true });
  console.log(`[manage-extension-artifacts] Copied Firefox unpacked build to ${targetFirefoxUnpacked}`);

  if (action === 'zip') {
    const files = fs.readdirSync(outputDir);
    const mainZip = files.find(
      f => f.endsWith('.zip') && !f.includes('sources') && (f.includes('firefox') || f.includes('cmdos')),
    );
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
