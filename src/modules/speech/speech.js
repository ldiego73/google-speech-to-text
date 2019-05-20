const speech = require("@google-cloud/speech");
const { Storage } = require("@google-cloud/storage");
const Socket = require("socket.io");
const fs = require("fs");

const Base = require("../base");
const log = console.log;
const error = console.error;

const client = new speech.SpeechClient({
  projectId: "personal-7",
  keyFilename: "./service-speech-to-text.json"
});
const storage = new Storage({
  projectId: "personal-7",
  keyFilename: "./service-storage.json"
});

const request = {
  config: {
    encoding: "LINEAR16",
    sampleRateHertz: 16000,
    languageCode: "es-PE",
    profanityFilter: false,
    enableWordTimeOffsets: true,
    audioChannelCount: 2,
    enableSeparateRecognitionPerChannel: true
  },
  interimResults: true
};

class Speech extends Base {
  constructor(router, server) {
    super(router, "speech");

    this.io = new Socket(server);

    this.io.on("connection", this.connection.bind(this));
  }

  connection(c) {
    log("Client connected to Server");

    let recognizeStream = null;

    c.on("join", data => {
      c.emit("messages", "Socket Connected to Server");
    });

    c.on("messages", data => {
      c.emit("broad", data);
    });

    c.on("start", data => {
      startRecognitionStream(c, data);
    });

    c.on("end", data => {
      stopRecognitionStream();
    });

    c.on("data", data => {
      if (recognizeStream !== null) {
        recognizeStream.write(data);
      }
    });

    function startRecognitionStream() {
      console.log("Iniciando...");

      recognizeStream = client
        .streamingRecognize(request)
        .on("error", error)
        .on("data", data => {
          console.log(JSON.stringify(data));
          process.stdout.write(
            data.results[0] && data.results[0].alternatives[0]
              ? `Transcription: ${data.results[0].alternatives[0].transcript}\n`
              : `\n\nReached transcription time limit, press Ctrl+C\n`
          );

          c.emit("speech", data);

          if (data.results[0] && data.results[0].isFinal) {
            stopRecognitionStream();
            startRecognitionStream(c);
          }
        });
    }

    function stopRecognitionStream() {
      console.log("Finalizando...");
      if (recognizeStream) recognizeStream.end();
      recognizeStream = null;
    }
  }

  routers() {
    this.get("/speech/file", this.file.bind(this));
    this.get("/speech/voice", this.voice.bind(this));
    this.post("/speech/upload", this.upload.bind(this));
  }

  async file(ctx) {
    await this.render(ctx, "file", { current: "file" });
  }

  async voice(ctx) {
    await this.render(ctx, "voice", { current: "voice" });
  }

  async upload(ctx, next) {
    const audio = ctx.request.files.audio;
    const bucket = storage.bucket("personal-audios");
    const file = bucket.file(audio.name);

    return new Promise((resolve, reject) => {
      fs.createReadStream(audio.path)
        .pipe(
          file.createWriteStream({
            metadata: {
              contentType: audio.type
            }
          })
        )
        .on("error", err => {
          log(err);
          ctx.status = 500;
          ctx.body = { error: err };
          resolve();
        })
        .on("finish", async () => {
          await file.makePublic();
          const transcription = await this.toText(audio.name);

          ctx.body = { transcription: transcription };
          resolve();
        });
    });
  }

  async toText(name) {
    const config = {
      encoding: "LINEAR16",
      languageCode: "es-PE",
      audioChannelCount: 2,
      enableSeparateRecognitionPerChannel: true
    };
    const audio = {
      uri: `gs://personal-audios/${name}`
    };
    const r = {
      config: config,
      audio: audio
    };
    const [operation] = await client.longRunningRecognize(r);
    const [response] = await operation.promise();
    const transcription = response.results
      .map(result => {
        return ` Channel Tag: ${result.channelTag} ${
          result.alternatives[0].transcript
        }`;
      })
      .join("\n");

    return transcription;
  }
}

module.exports = Speech;
