# Habilitar puerto de salida en la instancia

```
sudo apt-get install libcap2-bin
sudo setcap cap_net_bind_service=+ep `readlink -f \`which node\``
```

# Iniciar web

```
pm2 start src/server.js --name "web-speech" 
```

# Conectar a la instancia

```
sudo ssh -i aws-key.pem ubuntu@PORT
```
