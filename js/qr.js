export async function iniciarScannerQR(){

    return new Promise((resolve,reject)=>{

        const scanner = new Html5Qrcode("reader");

        scanner.start(
            {
                facingMode:"environment"
            },
            {
                fps:10,
                qrbox:250
            },
            async(decodedText)=>{

                await scanner.stop();

                resolve(decodedText);

            },
            ()=>{}
        );

    });

}