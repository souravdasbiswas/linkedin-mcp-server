/**
 * LinkedIn API version manager.
 * LinkedIn Marketing APIs use monthly versioning (e.g., "202603").
 * Each version is supported for ~12 months before sunset.
 */

export class ApiVersionManager {
  private version: string;

  constructor(version?: string) {
    this.version = version ?? this.getCurrentVersion();
  }

  /**
   * Get headers required for versioned LinkedIn API calls.
   */
  getHeaders(): Record<string, string> {
    return {
      'LinkedIn-Version': this.version,
      'X-Restli-Protocol-Version': '2.0.0',
    };
  }

  /**
   * Get the current API version string.
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * Update the API version.
   */
  setVersion(version: string): void {
    if (!/^\d{6}$/.test(version)) {
      throw new Error(`Invalid API version format: ${version}. Expected YYYYMM (e.g., "202603").`);
    }
    this.version = version;
  }

  /**
   * Compute the current version based on today's date.
   * LinkedIn versions are YYYYMM format.
   */
  private getCurrentVersion(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}${month}`;
  }
}
