/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow connections from other devices on your local network
  // Your brother can access via http://YOUR-LAPTOP-IP:3000
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
