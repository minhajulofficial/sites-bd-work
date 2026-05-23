/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Font Awesome's CSS injection mode needs server transpilation when used
  // from the App Router. Keeping the list explicit so future packages can be
  // appended in later PRs.
  transpilePackages: [
    "@fortawesome/fontawesome-svg-core",
    "@fortawesome/free-brands-svg-icons",
    "@fortawesome/free-regular-svg-icons",
    "@fortawesome/free-solid-svg-icons",
    "@fortawesome/react-fontawesome",
  ],
};

export default nextConfig;
