window.addBale = function () {

  // 🔹 Get form values
  const name = document.getElementById("name").value.trim();
  const price = document.getElementById("price").value;
  const weight = document.getElementById("weight").value.trim();
  const category = document.getElementById("category").value.trim();
  const description = document.getElementById("description").value.trim();

  const imageFile = document.getElementById("imageFile").files[0];
  const videoFile = document.getElementById("videoFile").files[0];

  // 🔹 File size limit (20MB)
  const MAX_SIZE = 20 * 1024 * 1024;

  // 🔴 VALIDATION
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

  // 🔹 Create FormData
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

  console.log("Sending data...");

  // 🔹 Send request
  fetch("https://134.209.182.39:8080/api/triciabales/upload", {
    method: "POST",
    body: formData
  })
  .then(res => {
    console.log("STATUS:", res.status);

    if (!res.ok) {
      throw new Error("Server error: " + res.status);
    }

    return res.json();
  })
  .then(data => {
    console.log("RESPONSE:", data);

    alert("✅ Bale added successfully!");

    // 🔄 OPTIONAL: Clear form after success
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
    console.error("ERROR:", err);
    alert("❌ Upload failed. Check console.");
  });
};