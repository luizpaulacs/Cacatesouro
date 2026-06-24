function rad(valor){
    return valor * Math.PI / 180;
}

export function haversine(
    lat1,
    lon1,
    lat2,
    lon2
){

    const R = 6371000;

    const dLat = rad(lat2-lat1);
    const dLon = rad(lon2-lon1);

    const a =
        Math.sin(dLat/2) *
        Math.sin(dLat/2)
        +
        Math.cos(rad(lat1))
        *
        Math.cos(rad(lat2))
        *
        Math.sin(dLon/2)
        *
        Math.sin(dLon/2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1-a)
        );

    return R*c;

}

export function obterLocalizacao(){

    return new Promise((resolve,reject)=>{

        navigator.geolocation.getCurrentPosition(
            pos=>{

                resolve({
                    lat:pos.coords.latitude,
                    lng:pos.coords.longitude
                });

            },
            erro=>reject(erro),
            {
                enableHighAccuracy:true,
                timeout:15000
            }
        );

    });

}