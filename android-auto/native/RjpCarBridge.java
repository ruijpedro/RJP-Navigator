package pt.rjp.navigator;

import android.content.Context;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Escreve, em armazenamento privado do Android, APENAS acessos rodoviários confirmados. */
@CapacitorPlugin(name = "RjpCarBridge")
public class RjpCarBridge extends Plugin {
    @PluginMethod
    public void setAccesses(PluginCall call) {
        JSArray accesses = call.getArray("accesses");
        if (accesses == null || accesses.length() > 1000) {
            call.reject("Lista de acessos inválida");
            return;
        }
        getContext().getSharedPreferences("rjp_car_accesses", Context.MODE_PRIVATE)
                .edit().putString("items", accesses.toString()).apply();
        call.resolve();
    }
}
