fetch("https://www.yenkasa.xyz/triciabales-api/api/triciabales")
  .then(res => res.json())
  .then(data => {
    const baleContainer = document.getElementById("bale-container");
    const dressContainer = document.getElementById("dress-container");

    data.forEach(item => {
      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        ${item.imageUrl ? `
          <div class="product-image-wrap">
            <img
              src="${item.imageUrl}"
              alt="${item.name}"
              class="product-image"
              onclick="openImage('${item.imageUrl}')"
            >
          </div>
        ` : ""}

        <div class="card-content">
          <div class="card-top">
            <h3>${item.name}</h3>
            <span class="status ${item.status}">${item.status}</span>
          </div>

          <p>${item.description}</p>

          <div class="price">GHS ${item.price}</div>

          <p>
            <strong>${item.type === "single" ? "Size" : "Weight"}:</strong>
            ${item.weight}
          </p>

          ${item.videoUrl
            ? `<video controls src="${item.videoUrl}"></video>`
            : ""}

          ${item.status !== "sold"
            ? `
              <a href="https://wa.me/233551699010?text=Hello%20Tricia,%20I%20am%20interested%20in%20${encodeURIComponent(item.name)}" target="_blank">
                <button>💬 Chat on WhatsApp</button>
              </a>
            `
            : `
              <button disabled>Sold Out</button>
            `}
        </div>
      `;

      if (item.type === "single") {
        dressContainer.appendChild(card);
      } else {
        baleContainer.appendChild(card);
      }
    });
  })
  .catch(err => {
    console.error(err);

    const errorHtml = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;background:white;border-radius:20px;">
        <h3>Unable to load products</h3>
        <p>Please check that the server is running.</p>
      </div>
    `;

    document.getElementById("bale-container").innerHTML = errorHtml;
    document.getElementById("dress-container").innerHTML = errorHtml;
  });

function openImage(src) {
  document.getElementById("modalImage").src = src;
  document.getElementById("imageModal").style.display = "flex";
}

function closeImage() {
  document.getElementById("imageModal").style.display = "none";
}
