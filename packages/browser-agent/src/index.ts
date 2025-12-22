/**
 * @gleam-openclaw/browser-agent
 *
 * Browser Agent for OpenClaw — connect to Brave/Edge/Chrome via userDataDir,
 * with 48-hour default timeout and checkpoint/resume support.
 */

import puppeteer, {
  Browser,
  Page,
  LaunchOptions,
  BrowserConnectOptions,
} from "puppeteer-core";
import EventEmitter from "eventemitter3";

export type BrowserType = "chromium" | "brave" | "edge" | "chrome";

export interface BrowserAgentConfig {
  browserType?: BrowserType;
  userDataDir?: string;
  headless?: boolean;
  executablePath?: string;
  timeout?: number; // Default: 172800000 (48 hours)
  viewport?: { width: number; height: number };
  args?: string[];
}

export interface BrowserCheckpoint {
  id: string;
  url: string;
  cookies: any[];
  localStorage: Record<string, string>;
  timestamp: Date;
  screenshot?: string;
}

export interface BrowserAgentEvents {
  connected: (browser: Browser) => void;
  pageCreated: (page: Page) => void;
  navigated: (url: string) => void;
  checkpointSaved: (checkpoint: BrowserCheckpoint) => void;
  error: (error: Error) => void;
  disconnected: () => void;
}

const BROWSER_PATHS: Record<BrowserType, string[]> = {
  chromium: [
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
  ],
  brave: [
    "/usr/bin/brave-browser",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  ],
  edge: [
    "/usr/bin/microsoft-edge",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ],
  chrome: [
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ],
};

export class BrowserAgent extends EventEmitter<BrowserAgentEvents> {
  private browser: Browser | null = null;
  private pages: Map<string, Page> = new Map();
  private config: Required<BrowserAgentConfig>;
  private checkpoints: BrowserCheckpoint[] = [];
  private timeoutTimer: NodeJS.Timeout | null = null;

  constructor(config: BrowserAgentConfig = {}) {
    super();
    this.config = {
      browserType: config.browserType || "chromium",
      userDataDir: config.userDataDir || "",
      headless: config.headless ?? true,
      executablePath: config.executablePath || "",
      timeout: config.timeout || 172800000, // 48 hours
      viewport: config.viewport || { width: 1920, height: 1080 },
      args: config.args || [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    };
  }

  async connect(): Promise<Browser> {
    const executablePath =
      this.config.executablePath ||
      this.findBrowserExecutable(this.config.browserType);

    const launchOptions: LaunchOptions = {
      executablePath,
      headless: this.config.headless,
      args: this.config.args,
      defaultViewport: this.config.viewport,
    };

    if (this.config.userDataDir) {
      launchOptions.userDataDir = this.config.userDataDir;
    }

    this.browser = await puppeteer.launch(launchOptions);
    this.emit("connected", this.browser);

    // Set up timeout
    this.timeoutTimer = setTimeout(() => {
      this.disconnect();
    }, this.config.timeout);

    // Handle disconnect
    this.browser.on("disconnected", () => {
      this.emit("disconnected");
      this.cleanup();
    });

    return this.browser;
  }

  async newPage(id?: string): Promise<Page> {
    if (!this.browser) throw new Error("Browser not connected");

    const page = await this.browser.newPage();
    const pageId = id || `page_${Date.now()}`;
    this.pages.set(pageId, page);

    await page.setViewport(this.config.viewport);
    this.emit("pageCreated", page);

    return page;
  }

  async navigate(pageId: string, url: string): Promise<void> {
    const page = this.pages.get(pageId);
    if (!page) throw new Error(`Page "${pageId}" not found`);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    this.emit("navigated", url);
  }

  async executeAction(
    pageId: string,
    action: string,
    params: Record<string, unknown> = {}
  ): Promise<unknown> {
    const page = this.pages.get(pageId);
    if (!page) throw new Error(`Page "${pageId}" not found`);

    switch (action) {
      case "click":
        await page.click(params.selector as string);
        break;
      case "type":
        await page.type(params.selector as string, params.text as string);
        break;
      case "screenshot":
        return await page.screenshot({
          encoding: "base64",
          fullPage: params.fullPage as boolean,
        });
      case "evaluate":
        return await page.evaluate(params.script as string);
      case "waitForSelector":
        await page.waitForSelector(params.selector as string, {
          timeout: (params.timeout as number) || 30000,
        });
        break;
      case "getContent":
        return await page.content();
      case "getText":
        return await page.evaluate(() => document.body.innerText);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async saveCheckpoint(pageId: string): Promise<BrowserCheckpoint> {
    const page = this.pages.get(pageId);
    if (!page) throw new Error(`Page "${pageId}" not found`);

    const cookies = await page.cookies();
    const localStorage = await page.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) items[key] = window.localStorage.getItem(key) || "";
      }
      return items;
    });

    const screenshot = await page.screenshot({ encoding: "base64" });

    const checkpoint: BrowserCheckpoint = {
      id: `bcp_${Date.now()}`,
      url: page.url(),
      cookies,
      localStorage,
      timestamp: new Date(),
      screenshot: screenshot as string,
    };

    this.checkpoints.push(checkpoint);
    this.emit("checkpointSaved", checkpoint);

    return checkpoint;
  }

  async restoreCheckpoint(
    pageId: string,
    checkpoint: BrowserCheckpoint
  ): Promise<void> {
    const page = this.pages.get(pageId);
    if (!page) throw new Error(`Page "${pageId}" not found`);

    await page.setCookie(...checkpoint.cookies);
    await page.goto(checkpoint.url, { waitUntil: "networkidle2" });

    await page.evaluate((items) => {
      for (const [key, value] of Object.entries(items)) {
        window.localStorage.setItem(key, value);
      }
    }, checkpoint.localStorage);
  }

  async disconnect(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.cleanup();
    }
  }

  getCheckpoints(): BrowserCheckpoint[] {
    return [...this.checkpoints];
  }

  isConnected(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  private cleanup(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    this.pages.clear();
    this.browser = null;
  }

  private findBrowserExecutable(type: BrowserType): string {
    const paths = BROWSER_PATHS[type] || BROWSER_PATHS.chromium;
    // In production, check which path exists
    return paths[0];
  }
}
