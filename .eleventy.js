import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import markdownIt from "markdown-it";

export default async function(eleventyConfig) {
  const dataPath = path.join(process.cwd(), "index.yml");
  if (fs.existsSync(dataPath)) {
    const raw = fs.readFileSync(dataPath, "utf8");
    const data = yaml.load(raw) || {};
    if (data && typeof data === "object") {
      Object.entries(data).forEach(([key, value]) => {
        eleventyConfig.addGlobalData(key, value);
      });
    }
  }

  const md = markdownIt({ html: true, linkify: true });

  eleventyConfig.addFilter("markdown", (content = "") => md.render(content));
  eleventyConfig.addFilter(
    "markdownInline",
    (content = "") => md.renderInline(content)
  );
  const bucketPath = path.join(process.cwd(), "bucket.yml");
  if (fs.existsSync(bucketPath)) {
    const bucket = yaml.load(fs.readFileSync(bucketPath, "utf8")) || {};
    eleventyConfig.addGlobalData("bucket", bucket.bucket || bucket);
  }

  eleventyConfig.addPassthroughCopy("assets");

  return {
    dir: {
      input: ".",
      output: "_site",
    },
  };
};
