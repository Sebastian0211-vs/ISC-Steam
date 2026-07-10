// Central upload size limits (in bytes).
// IMPORTANT: keep nginx `client_max_body_size` (deploy/nginx-iscsteam.conf)
// >= the largest value here, otherwise nginx returns 413 before Express sees the request.
const MB = 1024 * 1024;

export const UPLOAD_LIMITS = {
  // game builds/packages, screenshots, and future video previews
  gamePackage: 512 * MB,
  // avatars, banners, chat images
  image: 25 * MB,
};

export default UPLOAD_LIMITS;
