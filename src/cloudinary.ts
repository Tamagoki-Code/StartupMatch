// Unsigned client-side upload to Cloudinary. No secret key involved — the
// upload preset (configured server-side in the Cloudinary dashboard as
// "Unsigned") is the only thing that authorizes this from the browser.

const CLOUD_NAME = "dcheafa99"
const UPLOAD_PRESET = "startup_match_docs"

export async function uploadVerificationDocument(file: File): Promise<string> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("upload_preset", UPLOAD_PRESET)
  formData.append("folder", "verification_documents")

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    throw new Error("Failed to upload document. Please try again.")
  }

  const data = await res.json()
  if (!data.secure_url) {
    throw new Error("Upload succeeded but no file URL was returned.")
  }

  return data.secure_url as string
}
