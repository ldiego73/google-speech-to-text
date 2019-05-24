const { SpeechClient } = require("@google-cloud/speech");
const { LanguageServiceClient } = require("@google-cloud/language");
const { Storage } = require("@google-cloud/storage");
const Socket = require("socket.io");
const fs = require("fs");

const Base = require("../base");
const log = console.log;
const error = console.error;

const client = new SpeechClient({
  projectId: "personal-7",
  keyFilename: "./service-speech-to-text.json"
});
const natural = new LanguageServiceClient({
  projectId: "personal-7",
  keyFilename: "./service-natural.json"
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
    enableSeparateRecognitionPerChannel: true,
    model: "default"
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
        log("data => ", data);
        recognizeStream.write(data);
      }
    });

    function startRecognitionStream() {
      log("Iniciando...");

      recognizeStream = client
        .streamingRecognize(request)
        .on("error", error)
        .on("data", data => {
          log(JSON.stringify(data));
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
      log("Finalizando...");
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
    try {
      const audio = ctx.request.files.audio;
      const detect = ctx.request.body.detect || false;
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
            const result = {};

            result.transcription = transcription;

            if (detect) {
              result.sentiment = await this.analyzeSentiment(transcription);
              //result.content = await this.analyzeContent(transcription);
              result.entities = await this.analyzeEntitySentiment(transcription);
            }

            ctx.body = result;
            resolve();
          });
      });
    } catch (err) {
      log(err);
      ctx.status = 500;
      ctx.body = { error: err };
    }
  }

  async toText(name) {
    const config = {
      encoding: "LINEAR16",
      languageCode: "es-US",
      alternativeLanguageCodes: ["es-PE"],
      diarizationSpeakerCount: 2,
      enableSpeakerDiarization: true,
      enableAutomaticPunctuation: true,
      audioChannelCount: 2,
      enableSeparateRecognitionPerChannel: true,
      model: "default"
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
    const results = response.results;

    const transcription = results
      .map(result => result.alternatives[0].transcript)
      .join("\n");

    return transcription;
  }

  async analyzeSentiment(text) {
    const document = {
      content: text,
      type: "PLAIN_TEXT"
    };
    const [result] = await natural.analyzeSentiment({ document: document });
    const sentiment = result.documentSentiment;

    return sentiment;
  }

  async analyzeEntitySentiment(text) {
    const document = {
      content: text,
      type: "PLAIN_TEXT"
    };

    const [result] = await natural.analyzeEntitySentiment({ document });
    const entities = result.entities;

    console.log(JSON.stringify(entities));

    return entities;
  }

  async analyzeContent(text) {
    const document = {
      content: text,
      type: "PLAIN_TEXT"
    };

    const [result] = await natural.classifyText({ document });
    const content = result.entities;

    console.log(JSON.stringify(content));

    return content;
  }
}

module.exports = Speech;
