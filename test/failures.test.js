import { test } from "node:test";
import assert from "node:assert/strict";
import { isNetworkFailure } from "../dist/failures.js";

test("failures to fetch the model, in each browser's words, are network failures", () => {
  for (const error of [new TypeError("Failed to fetch"), new TypeError("NetworkError when attempting to fetch resource."), new TypeError("Load failed"), new Error('Could not locate file: "https://huggingface.co/x/onnx/encoder_model.onnx".')]) {
    assert.equal(isNetworkFailure(error), true, error.message);
  }
});

test("a device that can't run the model is not a network failure", () => {
  for (const error of [new Error("no available backend found. ERR: [webgpu] RangeError: Array buffer allocation failed"), new RangeError("Array buffer allocation failed"), new Error("Aborted(OOM)")]) {
    assert.equal(isNetworkFailure(error), false, error.message);
  }
});
