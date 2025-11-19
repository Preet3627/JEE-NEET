/**
 * Generates a URL for a simple, consistent avatar based on a user's name.
 * Uses the DiceBear API for initials-based avatars.
 * @param {string} name - The full name of the user.
 * @returns {string} The full URL to the generated SVG avatar.
 */
export const generateAvatar = (name) => {
  if (!name) {
    return `https://api.dicebear.com/8.x/initials/svg?seed=User`;
  }
  // Encode the name to make it URL-safe
  const encodedName = encodeURIComponent(name);
  return `https://api.dicebear.com/8.x/initials/svg?seed=${encodedName}`;
};
