window.addBale = function () {
  const name = document.getElementById("name").value.trim();
  const price = document.getElementById("price").value;
  const weight = document.getElementById("weight").value.trim();
  const category = document.getElementById("category").value.trim();
  const description = document.getElementById("description").value.trim();

  const imageFile = document.getElementById("imageFile").files[0];
  const videoFile = document.getElementById("videoFile").files[0];

  const MAX_SIZE = 20 * 1024 * 1024;

  if (!name || !price || !weight || !category) {
    alert("Please fill all required fields");
    return;
  }

  if (!imageFile) {
    alert("Please select an image");
    return;
  }

  if (imageFile.size > MAX_SIZE) {
    alert("Image too large (max 20MB)");
    return;
  }

  if (videoFile && videoFile.size > MAX_SIZE) {
    alert("Video too large (max 20MB)");
    return;
  }

  const formData = new FormData();
  formData.append("name", name);
  formData.append("price", price);
  formData.append("weight", weight);
  formData.append("category", category);
  formData.append("description", description);
  formData.append("status", "available");
  formData.append("image", imageFile);

  if (videoFile) {
    formData.append("video", videoFile);
  }

  fetch("https://www.yenkasa.xyz/triciabales-api/api/triciabales/upload", {
    method: "POST",
    body: formData
  })
    .then(async res => {
      const text = await res.text();

      console.log("Upload status:", res.status);
      console.log("Raw response:", text);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      return JSON.parse(text);
    })
    .then(data => {
      console.log("Upload success:", data);

      alert("✅ Bale added successfully!");

      document.getElementById("name").value = "";
      document.getElementById("price").value = "";
      document.getElementById("weight").value = "";
      document.getElementById("category").value = "";
      document.getElementById("description").value = "";
      document.getElementById("imageFile").value = "";
      document.getElementById("videoFile").value = "";

      document.getElementById("imagePreview").style.display = "none";
      document.getElementById("videoPreview").style.display = "none";
    })
    .catch(err => {
      console.error("Upload error:", err);
      alert(err.message);
    });
};