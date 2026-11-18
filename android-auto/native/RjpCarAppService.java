package pt.rjp.navigator;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import androidx.annotation.NonNull;
import androidx.car.app.CarAppService;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.Session;
import androidx.car.app.SessionInfo;
import androidx.car.app.model.Action;
import androidx.car.app.model.Header;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.MessageTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import androidx.car.app.validation.HostValidator;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Android Auto POI beta. O alvo é SEMPRE um acesso rodoviário validado pelo utilizador,
 * nunca a coordenada do eixo ferroviário. A condução é delegada numa app de navegação.
 */
public final class RjpCarAppService extends CarAppService {
    @NonNull
    @Override
    public HostValidator createHostValidator() {
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
        }
        return new HostValidator.Builder(this)
                .addAllowedHosts(androidx.car.app.R.array.hosts_allowlist_sample)
                .build();
    }

    @NonNull
    @Override
    public Session onCreateSession(@NonNull SessionInfo sessionInfo) {
        return new Session() {
            @NonNull
            @Override
            public Screen onCreateScreen(@NonNull Intent intent) {
                return new AccessScreen(getCarContext());
            }
        };
    }

    private static final class Access {
        final String title, subtitle;
        final double lat, lng;
        Access(String title, String subtitle, double lat, double lng) {
            this.title = title; this.subtitle = subtitle; this.lat = lat; this.lng = lng;
        }
    }

    private static List<Access> readConfirmed(Context context) {
        List<Access> output = new ArrayList<>();
        String json = context.getSharedPreferences("rjp_car_accesses", Context.MODE_PRIVATE)
                .getString("items", "[]");
        try {
            JSONArray data = new JSONArray(json);
            for (int i = 0; i < Math.min(1000, data.length()); i++) {
                JSONObject r = data.optJSONObject(i);
                if (r == null || !r.optBoolean("confirmed", false)) continue;
                double lat = r.optDouble("lat", Double.NaN), lng = r.optDouble("lng", Double.NaN);
                if (!Double.isFinite(lat) || !Double.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
                String linha = r.optString("linha", "Linha ferroviária");
                String pk = r.optString("pk", "");
                String rua = r.optString("name", "Acesso rodoviário");
                String title = pk.isEmpty() ? linha : linha + " · PK " + pk;
                output.add(new Access(title, rua + " · Confirmado no telemóvel", lat, lng));
            }
        } catch (Exception ignored) {
            // Nunca apresentar dados duvidosos se a cache estiver danificada.
        }
        return output;
    }

    private static final class AccessScreen extends Screen {
        AccessScreen(@NonNull CarContext context) { super(context); }
        @NonNull @Override
        public Template onGetTemplate() {
            List<Access> data = readConfirmed(getCarContext());
            if (data.isEmpty()) {
                return new MessageTemplate.Builder(
                    "Ainda não há acessos confirmados. No telemóvel, seleciona um PK, " +
                    "confirma uma estrada pública/transitável e guarda o acesso no Navigator."
                ).setHeader(new Header.Builder()
                        .setTitle("RJP Navigator · Acessos")
                        .setStartHeaderAction(Action.APP_ICON).build()).build();
            }
            ItemList.Builder list = new ItemList.Builder();
            for (int i = 0; i < Math.min(data.size(), 60); i++) {
                Access a = data.get(i);
                list.addItem(new Row.Builder()
                        .setTitle(a.title)
                        .addText(a.subtitle)
                        .setOnClickListener(() -> {
                            Uri uri = Uri.parse(String.format(Locale.US, "geo:0,0?q=%.7f,%.7f", a.lat, a.lng));
                            try {
                                getCarContext().startCarApp(new Intent(CarContext.ACTION_NAVIGATE, uri));
                            } catch (Exception ignored) {
                                // O Android Auto pode não ter uma app de navegação compatível.
                            }
                        }).build());
            }
            return new ListTemplate.Builder()
                    .setHeader(new Header.Builder()
                            .setTitle("Acessos rodoviários confirmados")
                            .setStartHeaderAction(Action.APP_ICON).build())
                    .setSingleList(list.build())
                    .build();
        }
    }
}
