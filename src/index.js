"use strict";
/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    async fetch(request, env, ctx) {
        return new Response("Hello World!");
    },
};
