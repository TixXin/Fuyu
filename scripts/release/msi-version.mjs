export function msiVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  if (!match) throw new Error(`"${version}" is not a version like 1.2.3 or 1.2.3-beta.1.`);
  const [, major, minor, patch, pre] = match;
  if (Number(major) > 255 || Number(minor) > 255 || Number(patch) > 65535) {
    throw new Error(`${version} does not fit an MSI version (major and minor at most 255, patch at most 65535).`);
  }
  if (!pre) return null;
  const numbers = pre.match(/\d+/g);
  const build = numbers ? Number(numbers[numbers.length - 1]) : 1;
  if (build < 1 || build > 65535) throw new Error(`The pre-release number of ${version} must be 1-65535 for the MSI version.`);
  return `${major}.${minor}.${patch}.${build}`;
}

export function msiNames(version) {
  const wix = msiVersion(version);
  return [`_${version}_x64_en-US.msi`, ...(wix ? [`_${wix}_x64_en-US.msi`] : [])];
}
