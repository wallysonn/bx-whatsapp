import { WABANormalizer } from './normalizers/WABANormalizer';

const payload = { 
     "object": "whatsapp_business_account", 
     "entry": [ 
         { 
             "id": "8856996819413533", 
             "changes": [ 
                 { 
                     "value": { 
                         "messaging_product": "whatsapp", 
                         "metadata": { 
                             "display_phone_number": "16505553333", 
                             "phone_number_id": "27681414235104944" 
                         }, 
                         "contacts": [ 
                             { 
                                 "profile": { 
                                     "name": "Kerry Fisher" 
                                 }, 
                                 "wa_id": "16315551234" 
                             } 
                         ], 
                         "messages": [ 
                             { 
                                 "from": "16315551234", 
                                 "id": "wamid.ABGGFlCGg0cvAgo-sJQh43L5Pe4W", 
                                 "timestamp": "1603059201", 
                                 "text": { 
                                     "body": "Hello this is an answer" 
                                 }, 
                                 "type": "text" 
                             } 
                         ] 
                     }, 
                     "field": "messages" 
                 } 
             ] 
         } 
     ] 
 };

const normalizer = new WABANormalizer();

if (normalizer.canHandle(payload)) {
    console.log("Normalizing payload...");
    try {
        const result = normalizer.normalize(payload);
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error normalizing:", error);
    }
} else {
    console.log("Normalizer cannot handle this payload.");
}
