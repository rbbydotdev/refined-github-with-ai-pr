import { Buffer } from "node:buffer";

const OWNER = "rbbydotdev";
const REPO = "testrepo";
const NOTES_REF = "notes/ai";
const GITHUB_API = "https://api.github.com";

const TOKEN = process.env.GITHUB_TOKEN;

const headers: Record<string, string> = {
  Accept: "application/vnd.github+json",
};

if (TOKEN) {
  headers.Authorization = `Bearer ${TOKEN}`;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }

  return res.json() as Promise<T>;
}

async function main(): Promise<void> {
  // 1. Find notes ref using matching-refs
  const refs = await getJson<
    Array<{
      ref: string;
      object: { sha: string; type: string };
    }>
  >(`${GITHUB_API}/repos/${OWNER}/${REPO}/git/matching-refs/${NOTES_REF}`);

  if (refs.length === 0) {
    console.error(`No notes ref found for ${NOTES_REF}`);
    return;
  }

  const notesRef = refs[0];
  const notesCommitSha = notesRef.object.sha;

  // 2. Get notes commit
  const commit = await getJson<{
    tree: { sha: string };
  }>(`${GITHUB_API}/repos/${OWNER}/${REPO}/git/commits/${notesCommitSha}`);

  const treeSha = commit.tree.sha;

  // 3. Get notes tree
  const tree = await getJson<{
    tree: Array<{
      path: string;
      type: string;
      sha: string;
    }>;
  }>(`${GITHUB_API}/repos/${OWNER}/${REPO}/git/trees/${treeSha}`);

  console.log("Git Notes:");
  console.log("----------");

  // 4. Read blobs
  for (const entry of tree.tree) {
    if (entry.type !== "blob") {
      continue;
    }

    const blob = await getJson<{
      content: string;
      encoding: string;
    }>(`${GITHUB_API}/repos/${OWNER}/${REPO}/git/blobs/${entry.sha}`);

    const noteText = Buffer.from(blob.content, "base64").toString("utf8");

    console.log(`\nCommit: ${entry.path}`);
    console.log(noteText.trimEnd());
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
