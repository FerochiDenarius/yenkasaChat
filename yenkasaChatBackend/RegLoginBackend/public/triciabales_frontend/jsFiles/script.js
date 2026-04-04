fetch("https://www.yenkasa.xyz/triciabales-api/api/triciabales")
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById("bale-container");

    data.forEach(bale => {
      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        ${bale.imageUrl ? `<img src="https://www.yenkasa.xyz/triciabales-api${bale.imageUrl}" alt="${bale.name}">` : ""}

        <div class="card-content">
          <div class="card-top">
            <h3>${bale.name}</h3>
            <span class="status ${bale.status}">${bale.status}</span>
          </div>

          <p>${bale.description}</p>

          <div class="price">GHS ${bale.price}</div>

          <p><strong>Weight:</strong> ${bale.weight}</p>

          ${bale.videoUrl
            ? `<video controls src="https://www.yenkasa.xyz/triciabales-api${bale.videoUrl}"></video>`
            : ""}

          ${bale.status !== "sold"
            ? `
              <a href="https://wa.me/233551699010?text=Hello%20Tricia,%20I%20am%20interested%20in%20${encodeURIComponent(bale.name)}" target="_blank">
                <button>💬 Chat on WhatsApp</button>
              </a>
            `
            : `
              <button disabled>Sold Out</button>
            `}
        </div>
      `;

      container.appendChild(card);
    });
  })
  .catch(err => {
    console.error(err);

    document.getElementById("bale-container").innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;background:white;border-radius:20px;">
        <h3>Unable to load products</h3>
        <p>Please check that the server is running.</p>
      </div>
    `;
  });