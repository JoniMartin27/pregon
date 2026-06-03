import type { ChannelAdapter } from "../types";
import { adaptContent } from "../adapt";

// Hashnode vía su API GraphQL (gql.hashnode.com) con un Personal Access Token.
export const hashnode: ChannelAdapter = {
  id: "hashnode",
  name: "Hashnode",
  group: "dev",
  capability: "auto",
  emoji: "🔷",
  supportsMarkdown: true,
  credentialFields: [
    { key: "token", label: "Personal Access Token", type: "password", required: true, help: "hashnode.com/settings/developer → Generate new token." },
    { key: "publicationId", label: "Publication ID", type: "text", required: true, help: "El id de tu blog (Hashnode → Blog dashboard, o vía su API)." },
  ],
  async publish({ content, credentials }) {
    const a = adaptContent(content, "hashnode");
    const query =
      "mutation Publish($input: PublishPostInput!) { publishPost(input: $input) { post { url } } }";
    const input = {
      title: a.title ?? "(sin título)",
      contentMarkdown: a.link ? `${a.text}\n\n${a.link}` : a.text,
      publicationId: credentials.publicationId,
    };
    const res = await fetch("https://gql.hashnode.com/", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: credentials.token },
      body: JSON.stringify({ query, variables: { input } }),
    });
    const json = await res.json().catch(() => ({}));
    if (json.errors?.length) {
      throw new Error(json.errors[0]?.message ?? "Hashnode error");
    }
    return { externalUrl: json?.data?.publishPost?.post?.url };
  },
};
