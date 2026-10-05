import { describe, expect, it } from "vitest";
import { parsePomXml } from "../../../src/analyzer/dependency/pom-xml.js";
import { loadTechnologyConfig } from "../../../src/analyzer/technology-config.js";

const config = loadTechnologyConfig();

describe("parsePomXml", () => {
  it("extracts dependencies with groupId, artifactId, and version", () => {
    const content = `<?xml version="1.0"?>
<project>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
      <version>3.2.0</version>
    </dependency>
  </dependencies>
</project>`;

    const result = parsePomXml(content, "pom.xml", config);

    expect(result.warnings).toEqual([]);
    expect(result.dependencies).toEqual([
      {
        packageName: "org.springframework.boot:spring-boot-starter-web",
        technology: "spring-boot",
        source: "pom.xml",
        sourcePath: "pom.xml",
        dependencyType: "runtime",
        versionConstraint: "3.2.0",
      },
    ]);
  });

  it("handles missing version/groupId fields gracefully", () => {
    const content = `<project>
  <dependencies>
    <dependency>
      <artifactId>some-lib</artifactId>
    </dependency>
  </dependencies>
</project>`;

    const result = parsePomXml(content, "pom.xml", config);
    expect(result.dependencies).toEqual([
      expect.objectContaining({ packageName: "some-lib", versionConstraint: null }),
    ]);
  });

  it("returns a structured warning for malformed XML instead of throwing", () => {
    const result = parsePomXml("<project><dependencies><dependency>", "pom.xml", config);
    expect(result.warnings[0]?.code).toBe("MALFORMED_MANIFEST");
  });

  it("handles a pom.xml with no <project> element", () => {
    const result = parsePomXml("<not-a-pom></not-a-pom>", "pom.xml", config);
    expect(result.dependencies).toEqual([]);
    expect(result.warnings[0]?.code).toBe("MALFORMED_MANIFEST");
  });

  it("handles multiple dependency entries", () => {
    const content = `<project>
  <dependencies>
    <dependency>
      <groupId>com.example</groupId>
      <artifactId>lib-a</artifactId>
      <version>1.0</version>
    </dependency>
    <dependency>
      <groupId>com.example</groupId>
      <artifactId>lib-b</artifactId>
      <version>2.0</version>
    </dependency>
  </dependencies>
</project>`;
    const result = parsePomXml(content, "pom.xml", config);
    expect(result.dependencies).toHaveLength(2);
  });
});
