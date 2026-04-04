const imageInput = document.getElementById("imageFile");
const videoInput = document.getElementById("videoFile");
const imagePreview = document.getElementById("imagePreview");
const videoPreview = document.getElementById("videoPreview");
const addBaleBtn = document.getElementById("addBaleBtn");
const progressWrap = document.getElementById("progressWrap");
const statusText = document.getElementById("statusText");

// Image preview
imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];

  if (!file) {
    imagePreview.style.display = "none";
    imagePreview.removeAttribute("src");
    return;
  }

  imagePreview.src = URL.createObjectURL(file);
  imagePreview.style.display = "block";
});

// Video preview
videoInput.addEventListener("change", () => {
  const file = videoInput.files[0];

  if (!file) {
    videoPreview.style.display = "none";
    videoPreview.removeAttribute("src");
    return;
  }

  videoPreview.src = URL.createObjectURL(file);
  videoPreview.style.display = "block";
});

// Upload Bale
addBaleBtn.addEventListener("click", async () => {
  const name = document.getElementById("name").value.trim();
  const price = document.getElementById("price").value.trim();
  const weight = document.getElementById("weight").value.trim();
  const category = document.getElementById("category").value.trim();
  const description = document.getElementById("description").value.trim();
  const status = document.getElementById("status").value;

  const imageFile = imageInput.files[0];
  const videoFile = videoInput.files[0];

  const MAX_SIZE = 20 * 1024 * 1024;

  // Validation
  if (!name || !price || !weight || !category) {
    alert("Please fill all required fields.");
    return;
  }

  if (!imageFile) {
    alert("Please select a bale image.");
    return;
  }

  if (imageFile.size > MAX_SIZE) {
    alert("Image is too large. Maximum size is 20MB.");
    return;
  }

  if (videoFile && videoFile.size > MAX_SIZE) {
    alert("Video is too large. Maximum size is 20MB.");
    return;
  }

  // Prepare form data
  const formData = new FormData();
  formData.append("name", name);
  formData.append("price", price);
  formData.append("weight", weight);
  formData.append("category", category);
  formData.append("description", description);
  formData.append("status", status);
  formData.append("image", imageFile);

  if (videoFile) {
    formData.append("video", videoFile);
  }

  // UI loading state
  addBaleBtn.disabled = true;
  addBaleBtn.textContent = "Uploading...";
  progressWrap.style.display = "block";
  statusText.style.display = "block";

  try {
    const response = await fetch(
      "https://www.yenkasa.xyz/triciabales-api/api/triciabales/uploads",
      {
        method: "POST",
        body: formData
      }
    );

    const rawText = await response.text();

    console.log("Upload status:", response.status);
    console.log("Upload response:", rawText);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${rawText}`);
    }

    let data = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { success: true };
    }

    alert("✅ Bale uploaded successfully!");

    // Reset form
    document.getElementById("name").value = "";
    document.getElementById("price").value = "";
    document.getElementById("weight").value = "";
    document.getElementById("category").value = "";
    document.getElementById("description").value = "";
    document.getElementById("status").value = "available";

    imageInput.value = "";
    videoInput.value = "";

    imagePreview.style.display = "none";
    imagePreview.removeAttribute("src");

    videoPreview.style.display = "none";
    videoPreview.removeAttribute("src");

  } catch (err) {
    console.error("Upload error:", err);
    alert(`❌ Upload failed.\n\n${err.message}`);
  } finally {
    addBaleBtn.disabled = false;
    addBaleBtn.textContent = "Upload Bale";
    progressWrap.style.display = "none";
    statusText.style.display = "none";
  }
});