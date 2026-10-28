import { describe, expect, it } from "vitest";
import { embedCode, embedTheme, embedUrl, shareUrl } from "./embed";

const origin = "https://graph.isaacchacko.com";

describe("embed links", () => {
  it("puts the state in the hash of the editor and of /embed", () => {
    expect(shareUrl(origin, "abc")).toBe(`${origin}/#abc`);
    expect(embedUrl(origin, "abc")).toBe(`${origin}/embed#abc`);
  });

  it("carries a theme as a query parameter, outside the hash", () => {
    expect(embedUrl(origin, "abc", "auto")).toBe(`${origin}/embed?theme=auto#abc`);
  });

  it("wraps the link in an iframe", () => {
    expect(embedCode(`${origin}/embed#abc`)).toBe(
      `<iframe src="${origin}/embed#abc" width="100%" height="480" style="border:0" loading="lazy" title="graph"></iframe>`,
    );
  });
});

describe("embedTheme", () => {
  it("uses the graph's theme unless told otherwise", () => {
    expect(embedTheme("midnight", null, false).id).toBe("midnight");
    expect(embedTheme("midnight", "", true).id).toBe("midnight");
    expect(embedTheme("midnight", "ink", true).id).toBe("ink");
  });

  it("falls back to the default theme for an unknown id", () => {
    expect(embedTheme("midnight", "nope", false).id).toBe("vault");
  });

  it("keeps the graph's theme under auto when it suits the page", () => {
    expect(embedTheme("midnight", "auto", true).id).toBe("midnight");
    expect(embedTheme("ink", "auto", false).id).toBe("ink");
  });

  it("swaps to Paper or Vault under auto when it does not", () => {
    expect(embedTheme("midnight", "auto", false).id).toBe("paper");
    expect(embedTheme("ink", "auto", true).id).toBe("vault");
  });
});
