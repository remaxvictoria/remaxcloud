const property = JSON.parse(localStorage.getItem("selectedProperty"));

if(!property){
  document.body.innerHTML = "<h2>No hay propiedad seleccionada</h2>";
}


document.getElementById("title").textContent = property.titulo;
document.getElementById("location").innerHTML = '<img src="img/ubicacion.png" class="logo-img"> ' + property.ubicacion;
document.getElementById("price").textContent = "$" + property.precio;
document.getElementById("mainImage").src = property.imagen || "https://picsum.photos/800/400";


document.getElementById("priceSide").textContent = "$" + property.precio;


document.getElementById("description").textContent =
  `Propiedad ubicada en ${property.ubicacion}. Excelente oportunidad para inversión o vivienda.`;


document.getElementById("img1").src = property.imagen || "https://picsum.photos/400/250?1";
document.getElementById("img2").src = property.imagen || "https://picsum.photos/400/250?2";
document.getElementById("img3").src = property.imagen || "https://picsum.photos/400/250?3";


document.getElementById("ubicacionText").textContent = property.ubicacion;

function goBack(){
  window.history.back();
}